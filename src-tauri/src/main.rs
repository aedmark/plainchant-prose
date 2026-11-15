#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod native_books;

use native_books::{decode_base64, FileDescriptor, FolderGrant, FolderScan, MoveReceipt, MutationReceipt,
    NativeBookState, NativeError, ReadEntry};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn select_book_folder(book_id: String, state: tauri::State<NativeBookState>) -> Result<Option<FolderGrant>, NativeError> {
    let selected = rfd::FileDialog::new().set_title("Select the Plainchant Prose Book Folder").pick_folder();
    selected.map(|path| state.authorize_root(&book_id, path)).transpose()
}

#[tauri::command]
fn scan_book_folder(authority_id: String, state: tauri::State<NativeBookState>) -> Result<FolderScan, NativeError> {
    state.scan(&authority_id)
}

#[tauri::command]
fn read_book_entry(authority_id: String, path: String, expected_exact: Option<String>,
    state: tauri::State<NativeBookState>) -> Result<ReadEntry, NativeError> {
    state.read(&authority_id, &path, expected_exact.as_deref())
}

#[tauri::command]
fn write_book_entry(authority_id: String, path: String, kind: String, text: Option<String>, data: Option<String>,
    expected_exact: Option<String>, state: tauri::State<NativeBookState>) -> Result<MutationReceipt, NativeError> {
    let bytes = match kind.as_str() {
        "text" if data.is_none() => text.unwrap_or_default().into_bytes(),
        "binary" if text.is_none() => decode_base64(data.as_deref().unwrap_or(""))
            .ok_or_else(|| NativeError { code: "folder-binary-invalid".into(),
                message: "The research file data is not valid base64.".into(), path: Some(path.clone()) })?,
        _ => return Err(NativeError { code: "folder-payload-invalid".into(),
            message: "The write payload kind does not match its data.".into(), path: Some(path.clone()) }),
    };
    state.write(&authority_id, &path, &bytes, expected_exact.as_deref())
}

#[tauri::command]
fn delete_book_entry(authority_id: String, path: String, expected_exact: String,
    state: tauri::State<NativeBookState>) -> Result<MutationReceipt, NativeError> {
    state.delete(&authority_id, &path, &expected_exact)
}

#[tauri::command]
fn move_book_entry(authority_id: String, from_path: String, to_path: String, expected_source: String,
    expected_target: Option<String>, state: tauri::State<NativeBookState>) -> Result<MoveReceipt, NativeError> {
    state.move_entry(&authority_id, &from_path, &to_path, &expected_source, expected_target.as_deref())
}

#[tauri::command]
fn finalize_book_operations(authority_id: String, operation_ids: Vec<String>,
    state: tauri::State<NativeBookState>) -> Result<(), NativeError> {
    state.finalize(&authority_id, &operation_ids)
}

#[tauri::command]
fn rollback_book_operations(authority_id: String, operation_ids: Vec<String>,
    state: tauri::State<NativeBookState>) -> Result<(), NativeError> {
    state.rollback(&authority_id, &operation_ids)
}

#[tauri::command]
fn start_book_folder_watch(app: tauri::AppHandle, authority_id: String,
    state: tauri::State<NativeBookState>) -> Result<u64, NativeError> {
    state.start_watch(app, &authority_id)
}

#[tauri::command]
fn stop_book_folder_watch(authority_id: String, state: tauri::State<NativeBookState>) -> Result<(), NativeError> {
    state.stop_watch(&authority_id)
}

#[tauri::command]
fn release_book_folder(authority_id: String, book_id: String,
    state: tauri::State<NativeBookState>) -> Result<(), NativeError> {
    state.release(&authority_id, &book_id)
}

fn book_file_name(name: &str) -> String { plain_file_name(name, "epub", "book") }

fn plain_file_name(name: &str, ext: &str, fallback: &str) -> String {
    let base: String = name.rsplit(|character| character == '/' || character == '\\').next().unwrap_or("")
        .chars().filter(|character| !character.is_control() && !matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*')).collect();
    let base = base.trim().trim_start_matches('.').to_string();
    let ending = format!(".{ext}");
    let stem = if base.to_ascii_lowercase().ends_with(&ending) { base[..base.len() - ending.len()].to_string() } else { base };
    format!("{}{}", if stem.trim().is_empty() { fallback } else { stem.trim() }, ending)
}

fn with_epub_extension(path: PathBuf) -> PathBuf {
    if path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("epub")) { return path; }
    let mut value = path.into_os_string();
    value.push(".epub");
    PathBuf::from(value)
}

// The EPUB handoff is unrelated to folder authority and retains its explicit Save dialog (P5-01, D-037).
#[tauri::command]
fn save_book_file(name: String, data: String) -> Result<Option<String>, String> {
    let bytes = decode_base64(&data).ok_or_else(|| "The book's data could not be read.".to_string())?;
    let picked = rfd::FileDialog::new().set_title("Save the Book").set_file_name(book_file_name(&name))
        .add_filter("EPUB book", &["epub"]).save_file();
    let Some(chosen) = picked else { return Ok(None); };
    let path = with_epub_extension(chosen);
    fs::write(&path, bytes).map_err(|error| format!("{}: {error}", path.display()))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn book_file_names_are_plain_and_end_in_epub() {
        assert_eq!(book_file_name("my-book.epub"), "my-book.epub");
        assert_eq!(book_file_name("../../etc/passwd"), "passwd.epub");
        assert_eq!(book_file_name("a\\b:c?.EPUB"), "bc.epub");
        assert_eq!(book_file_name(" .. "), "book.epub");
        assert_eq!(with_epub_extension(PathBuf::from("/tmp/My Book")), PathBuf::from("/tmp/My Book.epub"));
        assert_eq!(with_epub_extension(PathBuf::from("/tmp/a.EPUB")), PathBuf::from("/tmp/a.EPUB"));
    }

    #[test]
    fn command_payload_types_remain_serializable() {
        fn serializable<T: serde::Serialize>() {}
        serializable::<FolderGrant>();
        serializable::<FolderScan>();
        serializable::<ReadEntry>();
        serializable::<MutationReceipt>();
        serializable::<MoveReceipt>();
        serializable::<FileDescriptor>();
    }
}

fn main() {
    tauri::Builder::default()
        .manage(NativeBookState::default())
        .invoke_handler(tauri::generate_handler![
            select_book_folder, scan_book_folder, read_book_entry, write_book_entry, delete_book_entry,
            move_book_entry, finalize_book_operations, rollback_book_operations, start_book_folder_watch,
            stop_book_folder_watch, release_book_folder, save_book_file
        ])
        .build(tauri::generate_context!())
        .expect("error while running Plainchant Prose Tauri application")
        .run(|_app, _event| {});
}
