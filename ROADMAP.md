# Roadmap

Item IDs are permanent: `P<phase>-<nn>`. Never renumber them. `[ ]` is open, `[~]` is owned and in progress, `[x]`
is done, and `[-]` is dropped with its reason and decision. A completed item records its evidence and date.

Each gate is executable evidence. Passing a gate proves only the claims named by its checks.

## Phase 0: Repository and lineage

Goal: establish a truthful project repository and a testable static application shell.

- [x] P0-01 Adopt the Manifold for Plainchant Prose: replace the template placeholders with the product blueprint,
  decisions, roadmap, test plan, security boundaries, and handoff. Evidence: `python3 tools/check_docs.py` (2026-11-12).
- [x] P0-02 Establish Git on `master` with `origin` at `https://github.com/aedmark/plainchant-prose.git`, add ignore
  rules for local tools and generated output, verify the D-014 licence, and record the repository state in HANDOFF.
  Evidence: existing baseline commit `5f04650`, `git remote -v`, clean documentation check, and maintainer-authorized
  commit and push (2026-11-13).
- [x] P0-03 Copy the known-green Plainchant Scribe application, tests, fonts, icons, and Tauri shell from
  `e2b22186a481afb6b0180d0883ce21d393ae7352`; write `docs/archive/plainchant-lineage.md` with the Scribe foundation,
  the later Plainchant writing source, relevant decisions, removal targets, and inherited traps (D-016). Evidence:
  copied-file blob comparison, `npm test` (313/313), and `cargo test --manifest-path src-tauri/Cargo.toml` (15/15),
  with loopback and installed external-oracle access allowed (2026-11-13).
- [x] P0-04 Rename product, storage, cache, manifest, package, and Tauri identifiers to Plainchant Prose; replace the
  global Tauri object with imported internals, add a strict page CSP, and add a structure check that fails if inherited
  product identifiers return outside the lineage record (proposed D-008, D-016, D-017). Evidence: `npm test`
  (314/314), `cargo test --manifest-path src-tauri/Cargo.toml` (15/15), and a headless Chrome CSP smoke test that loaded
  the example Stage bridge with no violations (2026-11-13).
- [x] P0-05 Remove Scribe-only layout, cover, font, reader, fixed-layout, store-checking, and publication UI while
  keeping the multi-file project, Markdown, EPUB export, versions, library, find, offline, and native-folder
  foundations. Every removal has a structure guard and the retained baseline stays green. Evidence: `npm test`
  (197/197), `cargo test --manifest-path src-tauri/Cargo.toml` (5/5), and an exact-CSP headless Chrome smoke test that
  loaded the retained Stage bridge with no errors or policy violations (2026-11-14).
- [x] P0-06 Adapt the inherited Node, structure, and Rust tests to the trimmed Prose shell; add a headless Chromium
  runner with a disposable profile and make optional tools print "not run" with a reason when absent. Evidence:
  `npm test` (198/198 with LibreOffice; EPUBCheck and Ace reported `not run`), an explicit all-oracle skip run
  (197/197 with three named reasons), `npm run test:browser` (1/1 under the exact CSP, plus an expected failure after a
  deliberate title mutation), and `npm run tauri:test` (5/5) (2026-11-14).

**Gate 0:** the trimmed static shell opens with no network request, the retained pure modules run under Node, inherited
names and removed features are absent, the service-worker file list agrees with the page, the page has a strict CSP,
and all configured baseline checks report a final status.

## Phase 1: Format, book model, and durable working copy

Goal: open, edit, recover, and safely synchronize a multi-file book without reformatting untouched source.

- [x] P1-01 Specify the complete Prose source grammar with fixtures: `book.txt`, `#` chapter titles, `##` through
  `######` section headings, scene breaks, synopses, notes, boneyards, emphasis, quotes, and footnotes (D-010, D-011,
  D-018). Evidence: normative `docs/SOURCE_FORMAT.md`, seven fixture cases, `npm test` (202/202, including four
  fixture-consistency checks), and `python3 tools/check_docs.py` (2026-11-14).
- [x] P1-02 Build a pure parser that returns source ranges, diagnostics, book metadata, parts, chapters, scenes,
  printable blocks, notes, and footnotes. Rendering always escapes writer text; malformed marks remain editable.
  Evidence: `src/prose.js`, `npm test` (218/218 including exact fixture diagnostics, bounded hostile cases, and pure
  boundary checks), an expected 214/215 failure after disabling less-than escaping, and
  `python3 tools/check_docs.py` (2026-11-14).
- [x] P1-03 Build the pure book-index reader and range-splice writer. It preserves spacing, comment-like unknown lines,
  unknown metadata, and untouched source; an order edit changes only the recognized ordered-file span (D-019).
  Evidence: `src/book-index.js`, `src/splice.js`, `npm test` (229/229 including exact inverse and untouched-source
  checks), an expected mutation failure after weakening stale-source refusal, and `python3 tools/check_docs.py`
  (2026-11-15).
- [ ] P1-04 Design and implement the multi-file IndexedDB schema for books, files, versions, targets, folder links, and
  handoff records. Include upgrade, rollback or recovery, quota-failure, and two-tab tests before adopting the schema.
- [ ] P1-05 Implement debounced autosave, a synchronous emergency buffer, 30-day soft-delete recovery, and crash
  reconciliation for all dirty book files. Empty editor state never destroys the last durable chapter.
- [ ] P1-06 Implement Tauri folder linking and conflict decisions with canonical newlines and content fingerprints.
  The app never overwrites a file changed outside Prose; missing, added, renamed, and simultaneous edits produce
  explicit choices. Browser books use explicit import and export instead of persistent directory handles (D-012).
- [ ] P1-07 Implement narrow Tauri commands for native folder selection, reading, writing, and watching. Commands
  accept only canonical paths under a folder selected in a native dialog, enforce size limits, and expose no shell.

**Gate 1:** a fixture book opens from a real folder, edits one chapter, reloads from IndexedDB, writes only the changed
range, survives a forced-close recovery, and refuses to overwrite a simulated external change. Unit, browser, and Rust
tests cover the same path.

## Phase 2: Core writing experience

Goal: make a 120,000-word book comfortable to navigate and edit while keeping source visible and recoverable.

- [ ] P2-01 Adapt the plain-text editor, typing helpers, colour hints, undo-preserving edit path, and focus mode to the
  Prose grammar. Colour hints switch off with a visible reason if their layout diverges from the textarea.
- [ ] P2-02 Build the live reading preview from the parser output, with incremental redraw and accessible light and
  dark themes. Preview contains no non-printing note, boneyard, or synopsis text.
- [ ] P2-03 Build the binder from `book.txt` and parsed scenes. Parts and chapters reorder through index splices;
  scenes reorder through source-range moves within or across chapter files, with one undoable transaction.
- [ ] P2-04 Build the corkboard from scene synopses. Cards without a synopsis remain visible; drag and keyboard
  reordering share the binder transaction and announce the result to assistive technology.
- [ ] P2-05 Implement find and replace across ordered chapter files. Preview matches are derived; replacements are
  previewed, range-checked, and committed as one recoverable multi-file transaction.
- [ ] P2-06 Establish performance fixtures at 60,000, 120,000, and 200,000 words; measure parse, redraw, search,
  binder, and save latency on a recorded reference environment before setting budgets.

**Gate 2:** a keyboard-only user creates a chapter, writes and previews marked text, finds a phrase across the book,
moves a scene, undoes the move, reloads, and sees identical source. The 120,000-word fixture stays within the measured
budgets recorded in HANDOFF.

## Phase 3: Scribe handoff

Goal: turn a Prose book into a valid EPUB 3.3 that Plainchant Scribe imports without manual cleanup.

- [ ] P3-01 Build pure chapter-to-XHTML conversion. It maps chapter headings, paragraphs, quotes, emphasis, scene
  breaks, and notes; writer text is escaped and raw HTML never passes through.
- [ ] P3-02 Convert footnotes to the note structure Scribe accepts, after verifying current Scribe behaviour against a
  pinned source commit and fixtures. Missing, duplicate, and unused labels produce source-located diagnostics.
- [ ] P3-03 Generate the EPUB 3.3 container, package document, navigation document, stylesheet, and ordered XHTML
  chapters from `book.txt`. Reuse copied Scribe packaging code only with recorded lineage and adaptation tests.
- [ ] P3-04 Run every generated fixture through EPUBCheck when available; the suite reports the exact version or
  "not run." Plant malformed controls so the oracle is proven capable of failing.
- [ ] P3-05 Import each handoff fixture into Plainchant Scribe at a recorded commit, export it again, and compare
  structure. Record which properties Scribe preserves, normalizes, or restyles.
- [ ] P3-06 Record each successful handoff in IndexedDB with the source revision fingerprint, time, output name, and
  Scribe compatibility commit. Later edits show that the sent version is stale; Prose does not merge Scribe edits.

**Gate 3:** the example novel and non-fiction fixtures pass EPUBCheck, open in Scribe with correct metadata, parts,
chapter order, scene breaks, emphasis, quotes, and notes, and survive Scribe export. The evidence records tool versions.

## Phase 4: Writing aids and secondary exports

Goal: add high-value drafting aids without placing manuscript truth in an opaque project format.

- [ ] P4-01 Implement chapter, scene, selection, and book word counts from printable text; define the word boundary
  rule in tests.
- [ ] P4-02 Implement optional book and chapter targets plus daily history in IndexedDB (D-007). Failure to load
  statistics never blocks opening or editing the manuscript; v0.1 documents that moving only the book folder leaves
  this history behind.
- [ ] P4-03 Adapt versions to multi-file transactions with manual snapshots, retention, and scene-aware comparison.
  Restore previews every affected file and creates a version of the state it replaces.
- [ ] P4-04 Adapt narration estimates to prose reading rates, with a documented default and user setting. Estimates
  never enter source files.
- [ ] P4-05 Export one combined Markdown manuscript without notes, synopses, or boneyards unless the export dialog
  explicitly includes them. The book folder remains unchanged.
- [ ] P4-06 Export `.docx` for editors and agents. Record the selected minimal OOXML scope, test the archive as hostile
  output input, and compare with LibreOffice when available. Adding a library requires maintainer approval.

**Gate 4:** counts, targets, versions, compare, narration, combined Markdown, and DOCX operate on the same fixture and
survive reload. Restoring a version cannot silently overwrite a newer disk change.

## Phase 5: Installation, accessibility, and release

Goal: ship a recoverable, accessible browser application and Tauri desktop application as version `0.1.0`.

- [ ] P5-01 Complete the installable offline web application: manifest, update-safe network strategy, cache migration,
  and offline browser tests. No asset loads from another host.
- [ ] P5-02 Complete Tauri v2 packaging for Linux (D-013); use a strict content-security policy, disable the global
  Tauri object, and test every native allow-list.
- [ ] P5-03 Complete keyboard, focus, screen-reader naming, reduced-motion, zoom, and theme-contrast checks. Record
  manual results separately from automated accessibility claims.
- [ ] P5-04 Exercise quota exhaustion, corrupt IndexedDB, missing folders, permission revocation, disk-full writes,
  interrupted multi-file saves, hostile Markdown, oversized files, and malicious folder layouts.
- [ ] P5-05 Run release fixtures through Chromium, the Linux desktop package, EPUBCheck, Scribe, and the available
  reading systems; record exact versions and name unsupported or untested platforms (D-013).
- [ ] P5-06 Write user help for the source format, folder backups, conflict choices, restore, handoff ownership, and
  late revisions. Help describes only implemented behaviour.
- [ ] P5-07 Cut `0.1.0` only after every earlier gate passes or the maintainer explicitly accepts a named limitation;
  confirm GitHub private vulnerability reporting is enabled (D-015), publish an acknowledgement window, and update the
  changelog, handoff, security support table, and release evidence.

## Phase 6: Later candidates

This phase is uncommitted. Each item needs a fresh decision after `0.1.0` evidence exists.

- [ ] P6-01 Design a shared, versioned suite API for stable parser-independent utilities used by Plainchant, Scribe,
  Web, and Prose. Measure actual copied-code drift first; do not extract directly from one product's app globals.
- [ ] P6-02 Investigate a Scribe chapter-replace workflow for late Prose revisions, with a preview, identity rules,
  layout-preservation tests, and explicit ownership transfer. Prose remains one-way until accepted.
- [ ] P6-03 Evaluate a one-file-per-scene storage option only if real books show that range moves are unsafe or too
  slow. Migration requires explicit maintainer approval and a reversible conversion.
- [ ] P6-04 Evaluate searchable research and richer citation tooling after v0.1 user work tests the ignored
  `research/` convention and footnote-only interpretation (D-011).
- [ ] P6-05 Design an explicit portable backup for IndexedDB-only targets, streaks, versions, and handoff history after
  the v0.1 schema and real book sizes are known (D-007).
