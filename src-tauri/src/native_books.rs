use getrandom::getrandom;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::os::fd::OwnedFd;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use unicode_normalization::UnicodeNormalization;

#[cfg(target_os = "linux")]
use rustix::fs::{
    mkdirat, openat, openat2, renameat_with, unlinkat, AtFlags, Mode, OFlags, RenameFlags,
    ResolveFlags,
};

const MAX_FILES: usize = 10_000;
const MAX_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
const MAX_RESEARCH_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TEXT_UTF16: usize = 5_242_880;
const RECOVERY_DIR: &str = ".plainchant-prose-recovery";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl NativeError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), path: None }
    }

    fn at(code: &str, path: &str, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into(), path: Some(path.into()) }
    }
}

type NativeResult<T> = Result<T, NativeError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderGrant {
    pub authority_id: String,
    pub display_name: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDescriptor {
    pub path: String,
    pub kind: String,
    pub size: u64,
    pub exact: String,
    pub canonical: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderWarning {
    pub code: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScan {
    pub entries: Vec<FileDescriptor>,
    pub warnings: Vec<FolderWarning>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadEntry {
    #[serde(flatten)]
    pub descriptor: FileDescriptor,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationReceipt {
    pub operation_id: String,
    pub descriptor: Option<FileDescriptor>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveReceipt {
    pub operation_ids: Vec<String>,
    pub descriptor: FileDescriptor,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderChanged {
    authority_id: String,
    generation: u64,
}

#[derive(Default)]
struct WatchCoalescer {
    last_emit: Option<Instant>,
    generation: u64,
}

impl WatchCoalescer {
    fn observe(&mut self, now: Instant) -> Option<u64> {
        if self.last_emit.is_some_and(|last| now.duration_since(last) < Duration::from_millis(250)) {
            return None;
        }
        self.last_emit = Some(now);
        self.generation = self.generation.saturating_add(1);
        Some(self.generation)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryRecord {
    operation_id: String,
    path: String,
    previous_existed: bool,
    previous_exact: Option<String>,
    resulting_exact: Option<String>,
}

struct SelectedRoot {
    book_id: String,
    root_path: PathBuf,
    root_file: File,
    watcher: Option<RecommendedWatcher>,
    generation: u64,
    operations: HashMap<String, RecoveryRecord>,
}

#[derive(Default)]
struct Registry {
    by_authority: HashMap<String, SelectedRoot>,
    by_root: HashMap<PathBuf, (String, String)>,
}

#[derive(Clone, Default)]
pub struct NativeBookState {
    inner: Arc<Mutex<Registry>>,
}

fn io_error(code: &str, path: Option<&str>, error: impl std::fmt::Display) -> NativeError {
    NativeError {
        code: code.into(),
        message: error.to_string(),
        path: path.map(str::to_string),
    }
}

fn random_id(prefix: &str) -> NativeResult<String> {
    let mut bytes = [0u8; 16];
    getrandom(&mut bytes).map_err(|error| io_error("native-random-unavailable", None, error))?;
    Ok(format!("{}-{}", prefix, bytes.iter().map(|byte| format!("{byte:02x}")).collect::<String>()))
}

fn validate_book_id(book_id: &str) -> NativeResult<()> {
    if book_id.is_empty() || book_id.len() > 200 || book_id.chars().any(char::is_control) {
        return Err(NativeError::new("book-id-invalid", "The book identity is invalid."));
    }
    Ok(())
}

fn validate_relative_path(path: &str) -> NativeResult<()> {
    if path.is_empty() || path.len() > 1024 || path.contains('\\') || path.chars().any(char::is_control) {
        return Err(NativeError::at("folder-path-invalid", path, "The book-relative path is invalid."));
    }
    let candidate = Path::new(path);
    if candidate.components().any(|part| !matches!(part, Component::Normal(_))) {
        return Err(NativeError::at("folder-path-invalid", path, "The path must stay inside the selected folder."));
    }
    if path == RECOVERY_DIR || path.starts_with(&format!("{RECOVERY_DIR}/")) {
        return Err(NativeError::at("folder-path-reserved", path, "The recovery area is reserved."));
    }
    let managed = path == "book.txt"
        || (!path.contains('/') && path.to_ascii_lowercase().ends_with(".md"))
        || path.starts_with("research/");
    if !managed {
        return Err(NativeError::at("folder-path-unmanaged", path, "The path is outside the managed book set."));
    }
    Ok(())
}

fn collision_key(path: &str) -> String {
    path.nfc().flat_map(char::to_lowercase).collect()
}

fn sha256(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn canonical_text(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

fn descriptor(path: &str, bytes: &[u8]) -> NativeResult<(FileDescriptor, Option<String>)> {
    let is_text = path == "book.txt" || path.to_ascii_lowercase().ends_with(".md");
    if is_text {
        let text = std::str::from_utf8(bytes)
            .map_err(|_| NativeError::at("folder-text-invalid-utf8", path, "A manuscript file is not valid UTF-8."))?
            .to_string();
        if text.encode_utf16().count() > MAX_TEXT_UTF16 {
            return Err(NativeError::at("folder-text-too-large", path, "A manuscript file exceeds the text limit."));
        }
        let canonical = canonical_text(&text);
        Ok((FileDescriptor {
            path: path.into(), kind: "text".into(), size: bytes.len() as u64,
            exact: sha256(bytes), canonical: sha256(canonical.as_bytes()),
        }, Some(text)))
    } else {
        if bytes.len() as u64 > MAX_RESEARCH_BYTES {
            return Err(NativeError::at("folder-research-too-large", path, "A research file exceeds 64 MiB."));
        }
        let exact = sha256(bytes);
        Ok((FileDescriptor {
            path: path.into(), kind: "binary".into(), size: bytes.len() as u64,
            exact: exact.clone(), canonical: exact,
        }, None))
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let word = ((chunk[0] as u32) << 16)
            | ((chunk.get(1).copied().unwrap_or(0) as u32) << 8)
            | chunk.get(2).copied().unwrap_or(0) as u32;
        result.push(TABLE[((word >> 18) & 63) as usize] as char);
        result.push(TABLE[((word >> 12) & 63) as usize] as char);
        result.push(if chunk.len() > 1 { TABLE[((word >> 6) & 63) as usize] as char } else { '=' });
        result.push(if chunk.len() > 2 { TABLE[(word & 63) as usize] as char } else { '=' });
    }
    result
}

pub fn decode_base64(input: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(input.len() / 4 * 3);
    let mut accumulator = 0u32;
    let mut bits = 0u32;
    for byte in input.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A', b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52, b'+' => 62, b'/' => 63,
            b'=' => break, b'\r' | b'\n' | b' ' => continue, _ => return None,
        } as u32;
        accumulator = (accumulator << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((accumulator >> bits) as u8);
            accumulator &= (1 << bits) - 1;
        }
    }
    Some(out)
}

#[cfg(target_os = "linux")]
fn secure_open(root: &File, path: &str, flags: OFlags) -> NativeResult<OwnedFd> {
    openat2(
        root,
        path,
        flags | OFlags::CLOEXEC,
        Mode::empty(),
        ResolveFlags::BENEATH | ResolveFlags::NO_SYMLINKS | ResolveFlags::NO_MAGICLINKS,
    ).map_err(|error| io_error("folder-path-not-confined", Some(path), error))
}

#[cfg(not(target_os = "linux"))]
fn secure_open(_root: &File, path: &str, _flags: ()) -> NativeResult<File> {
    Err(NativeError::at("native-platform-unsupported", path, "Native book folders require Linux in version 0.1."))
}

#[cfg(target_os = "linux")]
fn read_confined(root: &File, path: &str) -> NativeResult<Vec<u8>> {
    let fd = secure_open(root, path, OFlags::RDONLY | OFlags::NOFOLLOW)?;
    let mut file = File::from(fd);
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|error| io_error("folder-read-failed", Some(path), error))?;
    Ok(bytes)
}

#[cfg(not(target_os = "linux"))]
fn read_confined(_root: &File, path: &str) -> NativeResult<Vec<u8>> {
    Err(NativeError::at("native-platform-unsupported", path, "Native book folders require Linux in version 0.1."))
}

fn collect_research(
    selected: &SelectedRoot,
    current: &Path,
    prefix: &str,
    entries: &mut Vec<FileDescriptor>,
    keys: &mut BTreeMap<String, String>,
    total: &mut u64,
) -> NativeResult<()> {
    let listing = fs::read_dir(current).map_err(|error| io_error("folder-scan-failed", Some(prefix), error))?;
    for item in listing {
        let item = item.map_err(|error| io_error("folder-scan-failed", Some(prefix), error))?;
        let name = item.file_name().into_string().map_err(|_| NativeError::at(
            "folder-name-invalid", prefix, "A research entry name is not valid Unicode."))?;
        let path = format!("{prefix}/{name}");
        validate_relative_path(&path)?;
        let meta = fs::symlink_metadata(item.path()).map_err(|error| io_error("folder-scan-failed", Some(&path), error))?;
        if meta.file_type().is_symlink() {
            return Err(NativeError::at("folder-symlink-blocked", &path, "Symlinks are not allowed in managed book files."));
        }
        if meta.is_dir() {
            let _ = secure_open(&selected.root_file, &path, OFlags::RDONLY | OFlags::DIRECTORY)?;
            collect_research(selected, &item.path(), &path, entries, keys, total)?;
        } else if meta.is_file() {
            let bytes = read_confined(&selected.root_file, &path)?;
            let (mark, _) = descriptor(&path, &bytes)?;
            add_descriptor(mark, entries, keys, total)?;
        }
    }
    Ok(())
}

fn add_descriptor(
    mark: FileDescriptor,
    entries: &mut Vec<FileDescriptor>,
    keys: &mut BTreeMap<String, String>,
    total: &mut u64,
) -> NativeResult<()> {
    let key = collision_key(&mark.path);
    if let Some(previous) = keys.insert(key, mark.path.clone()) {
        return Err(NativeError::at("folder-name-collision", &mark.path,
            format!("The path collides with {previous} after case and Unicode normalization.")));
    }
    *total = total.saturating_add(mark.size);
    if entries.len() >= MAX_FILES {
        return Err(NativeError::new("folder-too-many-files", "The book folder contains more than 10,000 managed files."));
    }
    if *total > MAX_TOTAL_BYTES {
        return Err(NativeError::new("folder-too-large", "The managed book folder exceeds 256 MiB."));
    }
    entries.push(mark);
    Ok(())
}

impl NativeBookState {
    pub fn authorize_root(&self, book_id: &str, chosen: PathBuf) -> NativeResult<FolderGrant> {
        validate_book_id(book_id)?;
        let root_path = fs::canonicalize(&chosen).map_err(|error| io_error("folder-selection-invalid", None, error))?;
        let metadata = fs::symlink_metadata(&root_path).map_err(|error| io_error("folder-selection-invalid", None, error))?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err(NativeError::new("folder-selection-invalid", "The selected location is not an ordinary directory."));
        }
        let root_file = File::open(&root_path).map_err(|error| io_error("folder-selection-invalid", None, error))?;
        #[cfg(target_os = "linux")]
        secure_open(&root_file, ".", OFlags::RDONLY | OFlags::DIRECTORY).map_err(|_| NativeError::new(
            "native-openat2-unavailable", "This Linux system cannot enforce confined folder access."))?;
        #[cfg(not(target_os = "linux"))]
        return Err(NativeError::new("native-platform-unsupported", "Native book folders require Linux in version 0.1."));

        let display_name = root_path.file_name().and_then(|name| name.to_str()).unwrap_or("Book folder").to_string();
        let authority_id = random_id("folder")?;
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        if let Some((owner, _)) = registry.by_root.get(&root_path) {
            return Err(NativeError::new("folder-already-linked", format!("This folder already belongs to book {owner}.")));
        }
        registry.by_root.insert(root_path.clone(), (book_id.into(), authority_id.clone()));
        registry.by_authority.insert(authority_id.clone(), SelectedRoot {
            book_id: book_id.into(), root_path, root_file, watcher: None,
            generation: 0, operations: HashMap::new(),
        });
        Ok(FolderGrant { authority_id, display_name, platform: "linux-tauri".into() })
    }

    pub fn scan(&self, authority_id: &str) -> NativeResult<FolderScan> {
        let registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        let mut entries = Vec::new();
        let mut warnings = Vec::new();
        let mut keys = BTreeMap::new();
        let mut total = 0;
        let listing = fs::read_dir(&selected.root_path).map_err(|error| io_error("folder-scan-failed", None, error))?;
        for item in listing {
            let item = item.map_err(|error| io_error("folder-scan-failed", None, error))?;
            let name = item.file_name().into_string().map_err(|_| NativeError::new(
                "folder-name-invalid", "A root entry name is not valid Unicode."))?;
            let meta = fs::symlink_metadata(item.path()).map_err(|error| io_error("folder-scan-failed", Some(&name), error))?;
            if name == RECOVERY_DIR {
                let interrupted = fs::read_dir(item.path()).map(|mut items| items.next().is_some()).unwrap_or(true);
                if interrupted {
                    warnings.push(FolderWarning { code: "folder-recovery-pending".into(), path: RECOVERY_DIR.into(), size: None });
                }
                continue;
            }
            let managed_file = name == "book.txt" || (!name.contains('/') && name.to_ascii_lowercase().ends_with(".md"));
            if name == "research" {
                if meta.file_type().is_symlink() || !meta.is_dir() {
                    return Err(NativeError::at("folder-symlink-blocked", &name,
                        "The managed research entry must be an ordinary directory."));
                }
                let _ = secure_open(&selected.root_file, "research", OFlags::RDONLY | OFlags::DIRECTORY)?;
                collect_research(selected, &item.path(), "research", &mut entries, &mut keys, &mut total)?;
            } else if managed_file {
                if meta.file_type().is_symlink() || !meta.is_file() {
                    return Err(NativeError::at("folder-symlink-blocked", &name, "Managed book entries must be ordinary files."));
                }
                let bytes = read_confined(&selected.root_file, &name)?;
                let (mark, _) = descriptor(&name, &bytes)?;
                add_descriptor(mark, &mut entries, &mut keys, &mut total)?;
            } else {
                warnings.push(FolderWarning { code: "folder-entry-ignored".into(), path: name, size: meta.is_file().then_some(meta.len()) });
            }
        }
        entries.sort_by(|left, right| left.path.cmp(&right.path));
        warnings.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(FolderScan { entries, warnings })
    }

    pub fn read(&self, authority_id: &str, path: &str, expected_exact: Option<&str>) -> NativeResult<ReadEntry> {
        validate_relative_path(path)?;
        let registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        let bytes = read_confined(&selected.root_file, path)?;
        let (mark, text) = descriptor(path, &bytes)?;
        if expected_exact.is_some_and(|expected| expected != mark.exact) {
            return Err(NativeError::at("folder-changed-before-read", path, "The file changed before it could be read."));
        }
        let data = (mark.kind == "binary").then(|| base64_encode(&bytes));
        Ok(ReadEntry { descriptor: mark, text, data })
    }

    pub fn write(&self, authority_id: &str, path: &str, bytes: &[u8], expected_exact: Option<&str>) -> NativeResult<MutationReceipt> {
        validate_relative_path(path)?;
        let (new_mark, _) = descriptor(path, bytes)?;
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get_mut(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        let previous = match read_confined(&selected.root_file, path) {
            Ok(value) => Some(value),
            Err(error) if error.code == "folder-path-not-confined" && !selected.root_path.join(path).exists() => None,
            Err(error) => return Err(error),
        };
        let previous_exact = previous.as_deref().map(sha256);
        if previous_exact.as_deref() != expected_exact {
            return Err(NativeError::at("folder-changed-before-write", path, "The file changed before the native replacement."));
        }
        let operation_id = random_id("operation")?;
        let record = RecoveryRecord {
            operation_id: operation_id.clone(), path: path.into(), previous_existed: previous.is_some(),
            previous_exact: previous_exact.clone(), resulting_exact: Some(new_mark.exact.clone()),
        };
        persist_recovery(selected, &record, previous.as_deref())?;
        if let Err(error) = confined_replace(selected, path, bytes, expected_exact) {
            if matches!(error.code.as_str(), "folder-write-failed" | "folder-changed-before-write") {
                let _ = remove_recovery(selected, &operation_id);
            }
            return Err(error);
        }
        selected.operations.insert(operation_id.clone(), record);
        Ok(MutationReceipt { operation_id, descriptor: Some(new_mark) })
    }

    pub fn delete(&self, authority_id: &str, path: &str, expected_exact: &str) -> NativeResult<MutationReceipt> {
        validate_relative_path(path)?;
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get_mut(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        let previous = read_confined(&selected.root_file, path)?;
        let exact = sha256(&previous);
        if exact != expected_exact {
            return Err(NativeError::at("folder-changed-before-write", path, "The file changed before the native deletion."));
        }
        let operation_id = random_id("operation")?;
        let record = RecoveryRecord { operation_id: operation_id.clone(), path: path.into(), previous_existed: true,
            previous_exact: Some(exact), resulting_exact: None };
        persist_recovery(selected, &record, Some(&previous))?;
        if let Err(error) = confined_delete(selected, path, expected_exact) {
            if matches!(error.code.as_str(), "folder-delete-failed" | "folder-changed-before-write") {
                let _ = remove_recovery(selected, &operation_id);
            }
            return Err(error);
        }
        selected.operations.insert(operation_id.clone(), record);
        Ok(MutationReceipt { operation_id, descriptor: None })
    }

    pub fn move_entry(&self, authority_id: &str, from_path: &str, to_path: &str,
        expected_source: &str, expected_target: Option<&str>) -> NativeResult<MoveReceipt> {
        if from_path == to_path {
            return Err(NativeError::at("folder-move-invalid", from_path, "The source and destination are the same."));
        }
        let source = self.read(authority_id, from_path, Some(expected_source))?;
        let bytes = source.text.as_deref().map(str::as_bytes).map(Vec::from)
            .or_else(|| source.data.as_deref().and_then(decode_base64))
            .ok_or_else(|| NativeError::at("folder-read-failed", from_path, "The source could not be read."))?;
        let created = self.write(authority_id, to_path, &bytes, expected_target)?;
        match self.delete(authority_id, from_path, expected_source) {
            Ok(deleted) => Ok(MoveReceipt {
                operation_ids: vec![created.operation_id, deleted.operation_id],
                descriptor: created.descriptor.expect("write receipts include a descriptor"),
            }),
            Err(error) => {
                let _ = self.rollback(authority_id, &[created.operation_id]);
                Err(error)
            }
        }
    }

    pub fn finalize(&self, authority_id: &str, operation_ids: &[String]) -> NativeResult<()> {
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get_mut(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        for operation_id in operation_ids {
            if selected.operations.remove(operation_id).is_none() {
                return Err(NativeError::new("folder-operation-invalid", "A recovery operation is not active."));
            }
            remove_recovery(selected, operation_id)?;
        }
        Ok(())
    }

    pub fn rollback(&self, authority_id: &str, operation_ids: &[String]) -> NativeResult<()> {
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get_mut(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        for operation_id in operation_ids.iter().rev() {
            let record = selected.operations.get(operation_id).cloned()
                .ok_or_else(|| NativeError::new("folder-operation-invalid", "A recovery operation is not active."))?;
            let current = read_confined(&selected.root_file, &record.path).ok();
            if current.as_deref().map(sha256) != record.resulting_exact {
                return Err(NativeError::at("folder-changed-before-rollback", &record.path,
                    "The file changed after the operation and cannot be rolled back automatically."));
            }
            if record.previous_existed {
                let backup = read_recovery(selected, operation_id)?;
                confined_replace(selected, &record.path, &backup, current.as_deref().map(sha256).as_deref())?;
            } else if current.is_some() {
                confined_delete(selected, &record.path,
                    record.resulting_exact.as_deref().expect("a created file has a resulting fingerprint"))?;
            }
            selected.operations.remove(operation_id);
            remove_recovery(selected, operation_id)?;
        }
        Ok(())
    }

    pub fn release(&self, authority_id: &str, book_id: &str) -> NativeResult<()> {
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        if selected.book_id != book_id {
            return Err(NativeError::new("folder-authority-owner-mismatch", "The folder grant belongs to another book."));
        }
        let root = selected.root_path.clone();
        registry.by_authority.remove(authority_id);
        registry.by_root.remove(&root);
        Ok(())
    }

    pub fn start_watch(&self, app: AppHandle, authority_id: &str) -> NativeResult<u64> {
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get_mut(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        if selected.watcher.is_some() { return Ok(selected.generation); }
        let authority = authority_id.to_string();
        let coalescer = Arc::new(Mutex::new(WatchCoalescer::default()));
        let coalescer_for_callback = coalescer.clone();
        let mut watcher = notify::recommended_watcher(move |_event: Result<notify::Event, notify::Error>| {
            let generation = match coalescer_for_callback.lock() {
                Ok(mut value) => value.observe(Instant::now()), Err(_) => return,
            };
            if let Some(generation) = generation {
                let _ = app.emit("prose-folder-changed", FolderChanged { authority_id: authority.clone(), generation });
            }
        }).map_err(|error| io_error("folder-watch-failed", None, error))?;
        watcher.watch(&selected.root_path, RecursiveMode::Recursive)
            .map_err(|error| io_error("folder-watch-failed", None, error))?;
        selected.watcher = Some(watcher);
        Ok(selected.generation)
    }

    pub fn stop_watch(&self, authority_id: &str) -> NativeResult<()> {
        let mut registry = self.inner.lock().map_err(|_| NativeError::new("native-state-poisoned", "Native folder state is unavailable."))?;
        let selected = registry.by_authority.get_mut(authority_id)
            .ok_or_else(|| NativeError::new("folder-authority-invalid", "The folder grant is no longer active."))?;
        selected.watcher = None;
        Ok(())
    }
}

#[cfg(target_os = "linux")]
fn recovery_fd(selected: &SelectedRoot) -> NativeResult<OwnedFd> {
    let created = match mkdirat(&selected.root_file, RECOVERY_DIR, Mode::from_raw_mode(0o700)) {
        Ok(()) => true,
        Err(error) if error == rustix::io::Errno::EXIST => false,
        Err(error) => return Err(io_error("folder-recovery-failed", None, error)),
    };
    if created {
        selected.root_file.sync_all().map_err(|error| io_error("folder-recovery-failed", None, error))?;
    }
    secure_open(&selected.root_file, RECOVERY_DIR, OFlags::RDONLY | OFlags::DIRECTORY)
}

#[cfg(target_os = "linux")]
fn create_file_at(dir: &OwnedFd, name: &str, bytes: &[u8]) -> NativeResult<()> {
    let fd = openat(dir, name, OFlags::CREATE | OFlags::EXCL | OFlags::WRONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
        Mode::from_raw_mode(0o600)).map_err(|error| io_error("folder-recovery-failed", Some(name), error))?;
    let mut file = File::from(fd);
    file.write_all(bytes).and_then(|_| file.sync_all()).map_err(|error| io_error("folder-recovery-failed", Some(name), error))
}

#[cfg(target_os = "linux")]
fn sync_dir(dir: &OwnedFd, code: &str, path: Option<&str>) -> NativeResult<()> {
    let duplicate = rustix::io::dup(dir).map_err(|error| io_error(code, path, error))?;
    File::from(duplicate).sync_all().map_err(|error| io_error(code, path, error))
}

#[cfg(target_os = "linux")]
fn persist_recovery(selected: &SelectedRoot, record: &RecoveryRecord, previous: Option<&[u8]>) -> NativeResult<()> {
    let dir = recovery_fd(selected)?;
    if let Some(bytes) = previous { create_file_at(&dir, &format!("{}.bak", record.operation_id), bytes)?; }
    let journal = serde_json::to_vec(record).map_err(|error| io_error("folder-recovery-failed", None, error))?;
    create_file_at(&dir, &format!("{}.json", record.operation_id), &journal)?;
    sync_dir(&dir, "folder-recovery-failed", None)
}

#[cfg(target_os = "linux")]
fn remove_recovery(selected: &SelectedRoot, operation_id: &str) -> NativeResult<()> {
    let dir = recovery_fd(selected)?;
    for name in [format!("{operation_id}.bak"), format!("{operation_id}.json")] {
        match unlinkat(&dir, name.as_str(), AtFlags::empty()) {
            Ok(()) => {}
            Err(error) if error == rustix::io::Errno::NOENT => {}
            Err(error) => return Err(io_error("folder-recovery-failed", None, error)),
        }
    }
    sync_dir(&dir, "folder-recovery-failed", None)
}

#[cfg(target_os = "linux")]
fn read_recovery(selected: &SelectedRoot, operation_id: &str) -> NativeResult<Vec<u8>> {
    let path = format!("{RECOVERY_DIR}/{operation_id}.bak");
    read_confined_internal(&selected.root_file, &path)
}

#[cfg(target_os = "linux")]
fn read_confined_internal(root: &File, path: &str) -> NativeResult<Vec<u8>> {
    let fd = secure_open(root, path, OFlags::RDONLY | OFlags::NOFOLLOW)?;
    let mut file = File::from(fd);
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|error| io_error("folder-recovery-failed", Some(path), error))?;
    Ok(bytes)
}

#[cfg(target_os = "linux")]
fn parent_fd(selected: &SelectedRoot, path: &str) -> NativeResult<(OwnedFd, String)> {
    let candidate = Path::new(path);
    let name = candidate.file_name().and_then(|part| part.to_str())
        .ok_or_else(|| NativeError::at("folder-path-invalid", path, "The file name is invalid."))?.to_string();
    let parent = candidate.parent().and_then(|part| part.to_str()).filter(|part| !part.is_empty()).unwrap_or(".");
    if parent != "." {
        let mut prior = ".".to_string();
        let mut cumulative = String::new();
        for component in parent.split('/') {
            let prior_fd = secure_open(&selected.root_file, &prior, OFlags::RDONLY | OFlags::DIRECTORY)?;
            match mkdirat(&prior_fd, component, Mode::from_raw_mode(0o700)) {
                Ok(()) => {}
                Err(error) if error == rustix::io::Errno::EXIST => {}
                Err(error) => return Err(io_error("folder-write-failed", Some(path), error)),
            }
            cumulative = if cumulative.is_empty() { component.to_string() } else { format!("{cumulative}/{component}") };
            let _ = secure_open(&selected.root_file, &cumulative, OFlags::RDONLY | OFlags::DIRECTORY)?;
            prior = cumulative.clone();
        }
    }
    let fd = secure_open(&selected.root_file, parent, OFlags::RDONLY | OFlags::DIRECTORY)?;
    Ok((fd, name))
}

#[cfg(target_os = "linux")]
fn read_at(dir: &OwnedFd, name: &str, path: &str) -> NativeResult<Vec<u8>> {
    let fd = openat(dir, name, OFlags::RDONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW, Mode::empty())
        .map_err(|error| io_error("folder-write-state-uncertain", Some(path), error))?;
    let mut file = File::from(fd);
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| io_error("folder-write-state-uncertain", Some(path), error))?;
    Ok(bytes)
}

#[cfg(target_os = "linux")]
fn confined_replace(selected: &SelectedRoot, path: &str, bytes: &[u8], expected_exact: Option<&str>) -> NativeResult<()> {
    let (parent, name) = parent_fd(selected, path)?;
    let temp = random_id(".prose-write")?;
    let fd = openat(&parent, temp.as_str(), OFlags::CREATE | OFlags::EXCL | OFlags::WRONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
        Mode::from_raw_mode(0o600)).map_err(|error| io_error("folder-write-failed", Some(path), error))?;
    let mut file = File::from(fd);
    file.write_all(bytes).and_then(|_| file.sync_all()).map_err(|error| io_error("folder-write-failed", Some(path), error))?;
    let flags = if expected_exact.is_some() { RenameFlags::EXCHANGE } else { RenameFlags::NOREPLACE };
    if let Err(error) = renameat_with(&parent, temp.as_str(), &parent, name.as_str(), flags) {
        let _ = unlinkat(&parent, temp.as_str(), AtFlags::empty());
        return Err(io_error("folder-write-failed", Some(path), error));
    }
    if let Some(expected) = expected_exact {
        let displaced = read_at(&parent, &temp, path)?;
        if sha256(&displaced) != expected {
            if let Err(error) = renameat_with(&parent, temp.as_str(), &parent, name.as_str(), RenameFlags::EXCHANGE) {
                return Err(io_error("folder-write-state-uncertain", Some(path), error));
            }
            unlinkat(&parent, temp.as_str(), AtFlags::empty())
                .map_err(|error| io_error("folder-write-state-uncertain", Some(path), error))?;
            sync_dir(&parent, "folder-write-state-uncertain", Some(path))?;
            return Err(NativeError::at("folder-changed-before-write", path,
                "The file changed during the native replacement."));
        }
        unlinkat(&parent, temp.as_str(), AtFlags::empty())
            .map_err(|error| io_error("folder-write-state-uncertain", Some(path), error))?;
    }
    sync_dir(&parent, "folder-write-state-uncertain", Some(path))
}

#[cfg(target_os = "linux")]
fn confined_delete(selected: &SelectedRoot, path: &str, expected_exact: &str) -> NativeResult<()> {
    let (parent, name) = parent_fd(selected, path)?;
    let quarantine = random_id(".prose-delete")?;
    renameat_with(&parent, name.as_str(), &parent, quarantine.as_str(), RenameFlags::NOREPLACE)
        .map_err(|error| io_error("folder-delete-failed", Some(path), error))?;
    let displaced = read_at(&parent, &quarantine, path)?;
    if sha256(&displaced) != expected_exact {
        if let Err(error) = renameat_with(&parent, quarantine.as_str(), &parent, name.as_str(), RenameFlags::NOREPLACE) {
            return Err(io_error("folder-delete-state-uncertain", Some(path), error));
        }
        sync_dir(&parent, "folder-delete-state-uncertain", Some(path))?;
        return Err(NativeError::at("folder-changed-before-write", path,
            "The file changed during the native deletion."));
    }
    unlinkat(&parent, quarantine.as_str(), AtFlags::empty())
        .map_err(|error| io_error("folder-delete-state-uncertain", Some(path), error))?;
    sync_dir(&parent, "folder-delete-state-uncertain", Some(path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn selected_book() -> (tempfile::TempDir, NativeBookState, FolderGrant) {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("book.txt"), "title: Test\n\nchapter.md\n").unwrap();
        fs::write(dir.path().join("chapter.md"), "One\r\nTwo\r\n").unwrap();
        let state = NativeBookState::default();
        let grant = state.authorize_root("book-1", dir.path().to_path_buf()).unwrap();
        (dir, state, grant)
    }

    #[test]
    fn path_validation_rejects_escape_absolute_reserved_and_unmanaged_paths() {
        for path in ["../book.txt", "/etc/passwd", "research/../book.txt", "research\\file", "", RECOVERY_DIR, "cover.png"] {
            assert!(validate_relative_path(path).is_err(), "accepted {path}");
        }
        for path in ["book.txt", "chapter.md", "research/notes.pdf"] { assert!(validate_relative_path(path).is_ok()); }
    }

    #[test]
    fn scan_hashes_exact_and_canonical_text_and_warns_for_unknown_root_files() {
        let (dir, state, grant) = selected_book();
        fs::write(dir.path().join("ignored.bin"), [1, 2, 3]).unwrap();
        let scan = state.scan(&grant.authority_id).unwrap();
        let chapter = scan.entries.iter().find(|entry| entry.path == "chapter.md").unwrap();
        assert_ne!(chapter.exact, chapter.canonical);
        assert_eq!(scan.warnings[0].code, "folder-entry-ignored");
        assert_eq!(scan.warnings[0].path, "ignored.bin");
    }

    #[test]
    fn same_root_cannot_belong_to_two_books_until_release() {
        let (dir, state, grant) = selected_book();
        assert_eq!(state.authorize_root("book-2", dir.path().to_path_buf()).unwrap_err().code, "folder-already-linked");
        assert_eq!(state.release(&grant.authority_id, "other").unwrap_err().code, "folder-authority-owner-mismatch");
        state.release(&grant.authority_id, "book-1").unwrap();
        state.authorize_root("book-2", dir.path().to_path_buf()).unwrap();
    }

    #[test]
    fn symlinks_and_normalized_name_collisions_block_scan() {
        let (dir, state, grant) = selected_book();
        std::os::unix::fs::symlink("chapter.md", dir.path().join("linked.md")).unwrap();
        assert_eq!(state.scan(&grant.authority_id).unwrap_err().code, "folder-symlink-blocked");
        fs::remove_file(dir.path().join("linked.md")).unwrap();
        std::os::unix::fs::symlink(".", dir.path().join("research")).unwrap();
        assert_eq!(state.scan(&grant.authority_id).unwrap_err().code, "folder-symlink-blocked");
        fs::remove_file(dir.path().join("research")).unwrap();
        fs::write(dir.path().join("CHAPTER.MD"), "collision").unwrap();
        assert_eq!(state.scan(&grant.authority_id).unwrap_err().code, "folder-name-collision");
    }

    #[test]
    fn native_write_repeats_fingerprint_and_retains_recovery_until_finalize() {
        let (dir, state, grant) = selected_book();
        let old = sha256(b"One\r\nTwo\r\n");
        let receipt = state.write(&grant.authority_id, "chapter.md", b"Changed\n", Some(&old)).unwrap();
        assert_eq!(fs::read(dir.path().join("chapter.md")).unwrap(), b"Changed\n");
        assert!(dir.path().join(RECOVERY_DIR).join(format!("{}.json", receipt.operation_id)).exists());
        assert_eq!(state.write(&grant.authority_id, "chapter.md", b"Wrong\n", Some(&old)).unwrap_err().code,
            "folder-changed-before-write");
        state.finalize(&grant.authority_id, &[receipt.operation_id.clone()]).unwrap();
        assert!(!dir.path().join(RECOVERY_DIR).join(format!("{}.json", receipt.operation_id)).exists());
    }

    #[test]
    fn exchange_and_quarantine_guards_restore_the_bytes_they_actually_displaced() {
        let (dir, state, grant) = selected_book();
        let registry = state.inner.lock().unwrap();
        let selected = registry.by_authority.get(&grant.authority_id).unwrap();
        let wrong = sha256(b"an earlier image");
        assert_eq!(confined_replace(selected, "chapter.md", b"replacement", Some(&wrong)).unwrap_err().code,
            "folder-changed-before-write");
        assert_eq!(fs::read(dir.path().join("chapter.md")).unwrap(), b"One\r\nTwo\r\n");
        assert_eq!(confined_delete(selected, "chapter.md", &wrong).unwrap_err().code,
            "folder-changed-before-write");
        assert_eq!(fs::read(dir.path().join("chapter.md")).unwrap(), b"One\r\nTwo\r\n");
    }

    #[test]
    fn rollback_restores_replaced_content_and_refuses_late_changes() {
        let (dir, state, grant) = selected_book();
        let old = sha256(b"One\r\nTwo\r\n");
        let first = state.write(&grant.authority_id, "chapter.md", b"Changed\n", Some(&old)).unwrap();
        state.rollback(&grant.authority_id, &[first.operation_id]).unwrap();
        assert_eq!(fs::read(dir.path().join("chapter.md")).unwrap(), b"One\r\nTwo\r\n");
        let second = state.write(&grant.authority_id, "chapter.md", b"Changed\n", Some(&old)).unwrap();
        fs::write(dir.path().join("chapter.md"), "external").unwrap();
        assert_eq!(state.rollback(&grant.authority_id, &[second.operation_id]).unwrap_err().code,
            "folder-changed-before-rollback");
    }

    #[test]
    fn create_move_delete_and_rollback_use_recoverable_confined_operations() {
        let (dir, state, grant) = selected_book();
        let created = state.write(&grant.authority_id, "research/nested/note.bin", b"notes", None).unwrap();
        assert_eq!(fs::read(dir.path().join("research/nested/note.bin")).unwrap(), b"notes");
        state.finalize(&grant.authority_id, &[created.operation_id]).unwrap();
        let source = sha256(b"notes");
        let moved = state.move_entry(&grant.authority_id, "research/nested/note.bin", "research/moved.bin",
            &source, None).unwrap();
        assert!(!dir.path().join("research/nested/note.bin").exists());
        assert_eq!(fs::read(dir.path().join("research/moved.bin")).unwrap(), b"notes");
        state.rollback(&grant.authority_id, &moved.operation_ids).unwrap();
        assert_eq!(fs::read(dir.path().join("research/nested/note.bin")).unwrap(), b"notes");
        assert!(!dir.path().join("research/moved.bin").exists());
        let deleted = state.delete(&grant.authority_id, "research/nested/note.bin", &source).unwrap();
        state.rollback(&grant.authority_id, &[deleted.operation_id]).unwrap();
        assert_eq!(fs::read(dir.path().join("research/nested/note.bin")).unwrap(), b"notes");
    }

    #[test]
    fn a_restart_reports_recovery_material_without_expiring_it() {
        let (dir, state, grant) = selected_book();
        let old = sha256(b"One\r\nTwo\r\n");
        state.write(&grant.authority_id, "chapter.md", b"Changed\n", Some(&old)).unwrap();
        state.release(&grant.authority_id, "book-1").unwrap();
        let restarted = NativeBookState::default();
        let next = restarted.authorize_root("book-1", dir.path().to_path_buf()).unwrap();
        let scan = restarted.scan(&next.authority_id).unwrap();
        assert!(scan.warnings.iter().any(|warning| warning.code == "folder-recovery-pending"));
        assert!(fs::read_dir(dir.path().join(RECOVERY_DIR)).unwrap().next().is_some());
    }

    #[test]
    fn invalid_utf8_and_oversized_research_are_rejected() {
        let (dir, state, grant) = selected_book();
        fs::write(dir.path().join("bad.md"), [0xff, 0xfe]).unwrap();
        assert_eq!(state.scan(&grant.authority_id).unwrap_err().code, "folder-text-invalid-utf8");
        fs::remove_file(dir.path().join("bad.md")).unwrap();
        fs::create_dir(dir.path().join("research")).unwrap();
        let file = File::create(dir.path().join("research/large.bin")).unwrap();
        file.set_len(MAX_RESEARCH_BYTES + 1).unwrap();
        assert_eq!(state.scan(&grant.authority_id).unwrap_err().code, "folder-research-too-large");
    }

    #[test]
    fn permission_loss_is_reported_without_releasing_the_working_copy_authority() {
        use std::os::unix::fs::PermissionsExt;
        let (dir, state, grant) = selected_book();
        let original = fs::metadata(dir.path()).unwrap().permissions();
        fs::set_permissions(dir.path(), fs::Permissions::from_mode(0o000)).unwrap();
        let result = state.scan(&grant.authority_id);
        fs::set_permissions(dir.path(), original).unwrap();
        assert_eq!(result.unwrap_err().code, "folder-scan-failed");
        assert!(state.scan(&grant.authority_id).is_ok());
    }

    #[test]
    fn base64_encoding_is_bounded_and_standard() {
        assert_eq!(base64_encode(b"hello"), "aGVsbG8=");
        assert_eq!(base64_encode(&[0, 1, 2, 3, 4, 255]), "AAECAwT/");
        assert_eq!(base64_encode(&[]), "");
    }

    #[test]
    fn scanner_limits_reject_the_next_file_and_the_next_total_byte() {
        let mut entries = Vec::new();
        let mut keys = BTreeMap::new();
        let mut total = 0;
        for index in 0..MAX_FILES {
            add_descriptor(FileDescriptor { path: format!("research/{index}.bin"), kind: "binary".into(), size: 0,
                exact: sha256(&[]), canonical: sha256(&[]) }, &mut entries, &mut keys, &mut total).unwrap();
        }
        let error = add_descriptor(FileDescriptor { path: "research/extra.bin".into(), kind: "binary".into(), size: 0,
            exact: sha256(&[]), canonical: sha256(&[]) }, &mut entries, &mut keys, &mut total).unwrap_err();
        assert_eq!(error.code, "folder-too-many-files");

        let mut entries = Vec::new();
        let mut keys = BTreeMap::new();
        let mut total = MAX_TOTAL_BYTES;
        let error = add_descriptor(FileDescriptor { path: "research/one.bin".into(), kind: "binary".into(), size: 1,
            exact: sha256(&[0]), canonical: sha256(&[0]) }, &mut entries, &mut keys, &mut total).unwrap_err();
        assert_eq!(error.code, "folder-too-large");
    }

    #[test]
    fn watcher_gate_coalesces_a_burst_and_advances_after_250_milliseconds() {
        let start = Instant::now();
        let mut gate = WatchCoalescer::default();
        assert_eq!(gate.observe(start), Some(1));
        assert_eq!(gate.observe(start + Duration::from_millis(249)), None);
        assert_eq!(gate.observe(start + Duration::from_millis(250)), Some(2));
    }
}
