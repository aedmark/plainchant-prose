# Architecture

This document maps the planned Plainchant Prose system. Paths and interfaces marked "planned" do not yet constitute
the target implementation, even where an inherited Scribe path has the same name. Why the system takes this shape
lives in [DECISIONS.md](DECISIONS.md); implementation order lives in
[ROADMAP.md](../ROADMAP.md).

## The shape, in one paragraph

The browser loads `app.html` and ordered classic scripts. A writer opens an IndexedDB working copy or links a Tauri
folder containing `book.txt` and `.md` chapters. Pure modules parse source into ranged metadata, parts, chapters,
scenes, printable blocks, and diagnostics. The app uses that one parse for the editor hints, binder, corkboard,
preview, search, statistics, and EPUB handoff. User edits splice source ranges and save to IndexedDB; folder sync writes
only files whose last-synced fingerprint still matches disk. Send to Scribe derives a new EPUB 3.3 and records the sent
revision. Nothing leaves the device, and no network resource is required.

## Target code map

| Area | Planned location | Entry point | Talks to |
| --- | --- | --- | --- |
| Source parser and renderer | `src/prose.js` | `Prose.parse`, `Prose.toHTML` | Pure text only |
| Book index and range edits | `src/book-index.js`, `src/splice.js` | `BookIndex.read`, `Splice.apply` | Pure text only |
| Book transactions | `src/book-change.js` | `BookChange.plan`, `BookChange.apply` | Parser and splice modules |
| Search, counts, outline, compare, narration | `src/finding.js`, `stats.js`, `outline.js`, `compare.js`, `narration.js` | One pure API per module | Parsed books or source maps |
| Folder conflict rules | `src/filesync.js` | `FileSync.decide` | Canonical text and fingerprints |
| EPUB handoff | `src/prose-xhtml.js`, `src/epub-handoff.js`, copied archive modules | `EpubHandoff.build` | Parsed book and source files |
| IndexedDB rules and adapter | `src/store.js`, `src/app/persistence.js` | `Store`, `saveBookChange` | IndexedDB and emergency storage |
| Browser application | `src/app/*.js` | `main.js` on `DOMContentLoaded` | All pure modules and browser APIs |
| Offline install | `sw.js`, `manifest.webmanifest`, `src/app/offline.js` | service-worker event handlers | Cache API |
| Desktop shell | `src-tauri/` | narrow Rust commands | Native dialogs and selected folders |
| Tests | `test/` | `test/run.js`, browser and Rust runners | Fixtures and optional oracles |

Names are provisional until the corresponding roadmap item creates or adapts the file. The current `src/`, `test/`,
and `src-tauri/` trees are the trimmed Scribe-derived foundation recorded in the lineage archive; they do not implement
this target map yet. New files update this map in the same change.

## Source contracts

The complete normative grammar, malformed-input recovery, diagnostic policy, and UTF-16 range convention live in
[SOURCE_FORMAT.md](SOURCE_FORMAT.md). The summary below defines the component boundary; it does not replace that
grammar.

### Book folder

`book.txt` is the only ordered index. Its initial contract is:

```text
Title: The Salt Road
Author: A. Writer
Language: en

Part: One
01-harbour.md
02-the-letter.md
Part: Two
03-crossing.md
```

- Metadata consists of `Key: value` lines before the ordered section. `Title`, `Author`, and `Language` are required;
  `Publish Date`, `Publisher`, and `Series` are optional. Duplicate or unknown keys stay unresolved until the user
  selects, rejects, or converts them to generalized `Custom: Name = value` metadata.
- A `Part: value` line labels the ordered chapters that follow until another part.
- A chapter entry is a relative `.md` path confined to the book folder. Absolute paths, traversal, control characters,
  and case or Unicode normalization collisions are refused.
- Index edits preserve unknown lines and original newline style. The writer resolves missing files, duplicate entries,
  and unlisted `.md` files; the app never guesses an order.

### Chapter source

- The first `# Title` is the chapter title. `##` through `######` are printable section headings at their standard
  Markdown levels (D-010).
- `* * *` alone is a printable scene break. An immediately associated `= Synopsis` is non-printing scene metadata.
- `[[note]]`, including multiline content, is a non-printing author note.
- `/* ... */`, including multiline content, is a non-printing boneyard.
- `*italic*`, `**bold**`, and `> quote` are printable Markdown-core constructs.
- `[^label]` and `[^label]: definition` form printable notes after validation.
- Unknown syntax remains visible source. Rendered writer text is escaped; raw HTML is never executed.

### Research files

An optional `research/` directory contains ordinary supporting files (D-011). It is outside manuscript order and is
ignored by parsing, binder construction, manuscript search, counts, preview, and export. Folder backup still carries
it as part of the writer-owned book folder. Prose does not interpret citations from it in v0.1.

The parser returns source ranges and diagnostics. It does not mutate text or touch environment APIs.

## Interfaces and data flow

```text
folder or IndexedDB files
    -> boundary validation
    -> Prose.parse + BookIndex.read
    -> one ranged derived book
       -> editor hints / binder / corkboard / preview / search / counts
       -> range edit or multi-file BookChange
          -> IndexedDB transaction + emergency intent
          -> fingerprint-checked folder synchronization
       -> EpubHandoff.build -> EPUBCheck evidence -> Scribe import evidence
```

| Interface | Producer | Consumer | Contract / compatibility |
| --- | --- | --- | --- |
| `book.txt` and `.md` text | Writer, import, folder sync | Parser and book-index reader | UTF-8 on disk; original newline style preserved during local splices |
| Parsed book | Pure parser | UI and domain modules | Immutable derived data with exact half-open source ranges and diagnostics |
| `BookChange` | Binder, corkboard, editor, replace, restore | Persistence and folder sync | Ordered file patches with before fingerprints; all apply or recover as one intent |
| IndexedDB book record | Persistence adapter | App startup, restore, versions | Versioned schema; schema contract is accepted only with migration and recovery tests |
| Folder snapshot | Tauri bridge or approved browser adapter | `FileSync.decide` | Relative paths, canonical bytes, size, modified time, and content fingerprint |
| EPUB bytes | `EpubHandoff.build` | Download, native save, Scribe | EPUB 3.3; exact compatibility commit and validator version recorded |
| Native command | App scripts | Tauri Rust shell | Dialog-granted root, confined relative path, operation-specific size limits |

## Invariants

- **Book files are authoritative.** Enforced by planned parser round-trip and splice-preservation tests (`P1-02`,
  `P1-03`; D-002).
- **A derived parse is never serialized over source.** Enforced by pure APIs accepting source plus explicit ranges;
  planned structure and mutation tests (`P1-02`, `P1-03`).
- **Every user-visible text edit preserves browser undo.** Enforced by the shared edit entry point and browser tests
  (`P2-01`).
- **Every persisted multi-file change is recoverable as one intent.** Enforced by IndexedDB transaction and injected
  interruption tests (`P1-04`, `P1-05`; proposed D-007).
- **No disk file is overwritten after an external change.** Enforced by fingerprint conflict rules, native integration
  tests, and a real-folder gate (`P1-06`, `P1-07`).
- **The parser and domain modules never touch the DOM, `window`, IndexedDB, Tauri, or Node-only APIs.** Enforced by Node
  tests and a planned import scan (`P0-05`).
- **Writer text enters HTML only through contextual escaping.** Enforced by hostile-input parser and export fixtures
  (`P1-02`, `P3-01`).
- **The static app loads nothing from another host.** Enforced by the structure test and offline browser test (`P0-05`,
  `P5-01`).
- **Native file access stays under a dialog-selected root.** Enforced by Rust traversal, symlink, alias, and revocation
  tests (`P1-07`; proposed D-008).
- **A handoff never changes the source book.** Enforced by before-and-after folder fingerprints (`P3-03`; D-005).
- **Missing external oracles report "not run."** Enforced by the harness control tests (`P0-05`; D-006).

## Boundaries

| Boundary | Comes in as | Checked by | Rule |
| --- | --- | --- | --- |
| Writer text | UTF-16 editor string or UTF-8 file bytes | Decoder, parser limits, contextual HTML escaping | Never becomes markup without conversion and escaping |
| Book index paths | Text lines | Path and collision validator | Relative `.md` paths inside the chosen root only |
| Folder contents | Names, metadata, bytes, watch events | Tauri shell limits and app conflict rules | No implicit delete, rename, order, or overwrite |
| IndexedDB | Versioned records from an earlier or interrupted run | Schema validator and recovery state machine | Unknown or corrupt state opens a recovery path, never a destructive reset |
| EPUB or DOCX output | Locally generated archive bytes | Byte-level tests and external oracle where available | Fixed entry limits and deterministic package rules |
| Scribe compatibility | Imported handoff fixture | Pinned Scribe commit and structural comparison | Compatibility claim names the tested commit |
| Network | No application input | CSP and structure test | Runtime assets and manuscript data never leave the device |

## Dependencies

The target frontend has no runtime package dependency (D-001). Copied Plainchant and Scribe modules become maintained
project code with recorded lineage, not package dependencies (D-016). The current foundation vendors Prism 1.30.0
and local font files with their licence notices.

| Dependency | Version policy | For | Boundary |
| --- | --- | --- | --- |
| Chromium browser APIs | Release-tested version recorded for each release | Static app, IndexedDB, service worker, explicit import and export | No persistent browser directory handles in v0.1 (D-012, D-013) |
| Node.js | 18 or newer (`package.json`) | Pure, structure, and browser-runner tests | Development only |
| Tauri | v2, exact crates locked at implementation | Desktop shell | Build and native runtime only |
| Python | 3.x standard library | `tools/check_docs.py` and static server | Development only |
| EPUBCheck | Exact observed version in each result | EPUB conformance oracle | Optional development and release tool |
| Plainchant Scribe | Exact commit in each result | Handoff compatibility oracle | Sibling application, never a runtime import |

Any new dependency requires maintainer approval and an accepted decision.

## State and caches

| What | Planned location | Written by | Reset or recovery | Committed? |
| --- | --- | --- | --- | --- |
| Authoritative manuscript | Selected book folder | Writer and conflict-checked sync | Writer backup and explicit restore | No |
| Working books and dirty files | IndexedDB `plainchant-prose` | Persistence adapter | Recovery UI; never silently reset | No |
| Versions and deleted books | IndexedDB | Store and versions modules | Retention rules and explicit action | No |
| Multi-file intent and emergency text | IndexedDB plus minimal localStorage buffer | Persistence adapter | Reconciled at startup | No |
| Targets, streaks, handoff log | IndexedDB `plainchant-prose` | Stats and handoff modules | Explicit reset; portable backup is later work (`P6-05`) | No |
| Folder grants and fingerprints | IndexedDB and Tauri process state | Folder adapter | Permission revocation or unlink | No |
| Offline application copy | Cache API | Service worker | Versioned cache activation | No |
| Test profiles and generated archives | Fresh temporary directories | Test runners | Deleted by runner | No, except named fixtures |

## Failure modes and observability

| Failure | User-visible behaviour | Detection | Recovery |
| --- | --- | --- | --- |
| IndexedDB unavailable or full | Editing stops before an unsafe promise; export or copy text remains available | Rejected transaction and quota classification | Free space, export, or retry; disk source stays unchanged |
| Tab or process closes mid-edit | Recovery view identifies dirty files and pending intent | Emergency buffer and intent record | Reconcile into a new working revision before sync |
| Disk file changed elsewhere | Conflict names every changed file and shows both revisions | Fingerprint differs from last sync | Load disk, keep working copy as a new file, or compare; no automatic overwrite |
| Tauri folder permission disappears | Linked status pauses with relink action | Native permission failure | Select the folder again; IndexedDB copy remains available |
| `book.txt` is invalid | Binder shows source-located problems; editing remains possible | Pure index diagnostics | Writer fixes explicit lines; no guessed order |
| Parser sees malformed marks | Source remains editable; preview omits unsafe interpretation and shows diagnostics | Pure parser diagnostics | Writer closes or escapes the mark |
| Multi-file scene move is interrupted | Startup reports an incomplete operation | Intent state and before fingerprints | Complete or roll back from stored before images |
| Handoff fails validation | No success record; output is labelled invalid or withheld | Built-in checks and EPUBCheck | Fix source-located problem and rebuild |
| Scribe changes import behaviour | Compatibility suite fails against the new commit | Pinned cross-repository fixture | Keep the last supported claim or adapt in a reviewed change |
| Service-worker update is partial | Existing complete version continues | Atomic cache version and browser offline test | Retry update; never delete the active cache first |

Diagnostics may contain relative file names, line numbers, sizes, and internal error codes. Logs must not contain full
manuscript text, research notes, absolute personal paths, or recovered version contents.

## Claims vs. code

- The repository began from a byte-for-byte Scribe foundation at commit
  `e2b22186a481afb6b0180d0883ce21d393ae7352`; its complete copied-file manifest is in
  `docs/archive/plainchant-lineage.md`. P0-04 renamed its application and persistent identifiers to Prose. P0-05
  removed its publication, reader, device, cover, font, fixed-layout, store-checking, preview-server, EPUB association,
  and Scribe-help surfaces while retaining named foundation seams.
- Plainchant commit `173a2ff0660b1304be89d439efd217f24c749c4b` is the secondary writing-source reference;
  no Plainchant file has been copied.
- EPUBCheck and Scribe compatibility are planned evidence. No Prose EPUB has been generated or tested.
- The supported v0.1 environments are Linux Tauri and Chromium browser or PWA (D-013). No release evidence exists yet.
- The IndexedDB transaction design in D-007 is accepted but remains unimplemented. The native boundary in D-008 stays
  proposed until its roadmap item supplies executable evidence and maintainer acceptance.
- The complete source grammar and normative fixture expectations exist under `P1-01`; the parser and book-index
  reader remain unimplemented until `P1-02` and `P1-03`.
- The Tauri page disables the public global object and enforces the D-017 CSP. P0-05 removed the inherited preview,
  EPUBCheck, cover-save, desktop-open, and EPUB-association boundaries. D-008 stays proposed until folder-confinement
  work supplies its full evidence.
