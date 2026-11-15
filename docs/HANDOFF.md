# Session handoff

Read this first when resuming work. Rewrite Current state when the repository changes materially or work pauses. The
session log is append-only; permanent rules live in the linked owner documents.

Protocol: [AGENTS.md](../AGENTS.md). Plan: [ROADMAP.md](../ROADMAP.md). Architecture:
[ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [DECISIONS.md](DECISIONS.md). Tests: [TESTING.md](TESTING.md).
Security: [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md). History: [archive/](archive/README.md).

## Current state

_Last updated: 2026-11-15, session 13, on `master` tracking `origin/master`: P1-07 implements the dialog-scoped,
Linux-confined native book-folder boundary and retained native-operation recovery. The change is not committed._

**Session owner:** None.

**Where things stand:** `BRIEF.md` remains the maintainer-owned source. Prose uses `.md` chapters, an ignored optional
`research/` directory, IndexedDB-only history, Tauri-only linked folders, and Linux desktop plus Chromium browser or
PWA support. The renamed and trimmed Scribe foundation comes from commit
`e2b22186a481afb6b0180d0883ce21d393ae7352`; its provenance is in `docs/archive/plainchant-lineage.md`. P1-01 defines
the source grammar and fixtures. P1-02 parses immutable ranged books and renders escaped preview HTML. P1-03 adds the
sole lossless `book.txt` reader, strict splices, and stale-source-checked order planning. P1-04 adds pure storage rules
and an IndexedDB v3 adapter for separate books, files, versions, intents, targets, folder metadata, and handoffs. P1-05
adds pure recovery and retention rules plus a callable browser persistence session for all dirty book files. The
retained shell still has generic studio concepts and uses the preserved v2 stores; the Prose editor has not adopted
the v3 session. P1-06 adds pure three-way folder decisions, a callable path-free synchronization coordinator, and an
explicit bounded ZIP for Chromium or PWA book transfer. P1-07 replaces the inherited broad native project-folder
commands and loopback server with opaque selected-root
authority, bounded native scans, exact preflighted mutations, recoverable rollback, and coalesced watch notifications.

**Verified** (2026-11-15; Node 22.23.5, Python 3.14.10, Google Chrome 157.0.8103.78, current Rust toolchain)

| Suite | Result |
| --- | --- |
| `npm test` | **257/257 passed**; native-boundary structure, sync, and transfer rules passed, LibreOffice ran, EPUBCheck and Ace reported `not run` with reasons |
| Fingerprint-preflight mutation | **Expected failure** when the final exact disk fingerprint check was removed; implementation restored |
| Native-preflight mutation | **Expected failure** when Rust's exact expected-fingerprint refusal was disabled; implementation restored |
| Recovery-finalization mutation | **Expected failure** when sync skipped native recovery finalization; implementation restored |
| `npm run test:browser` | **1/1 starter and 32/32 storage, persistence, sync, and transfer passed** in a disposable Chrome profile and origins under the exact CSP |
| `npm run tauri:test` | **16 passed, 0 failed** on temporary Linux folders |
| `python3 tools/check_docs.py` | **0 errors, 0 warnings in 15 files** |

**What works**

- The source grammar, immutable ranged parser, escaped renderer, export gate, and lossless `book.txt` splice planner
  preserve CRLF, byte-order marks, unknown source, and exact ranges.
- IndexedDB v3 separates books, files, versions, intents, targets, folder metadata, and handoffs while preserving v2.
  Serialized revisions, emergency text, atomic versions, recoverable intents, and explicit deletion cover failure and
  restart states without destructive repair.
- Folder decisions compare last-synced, IndexedDB, and disk SHA-256 snapshots. Canonical equality changes newlines
  only; unresolved additions, deletions, simultaneous edits, aliases, and renames pause every mutation.
- The sync session requires one in-memory authority per book, repeats exact preflights, versions before external loads,
  and stores display metadata and bounded fingerprints without native paths or grants.
- Tauri folder selection returns an opaque process-only authority. Rust retains the canonical root and owning book,
  confines managed paths through Linux `openat2`, hashes scans natively, and rejects traversal, symlinks, normalized
  aliases, duplicate owners, invalid text, permission loss, stale fingerprints, and configured limits.
- Native create, replace, delete, and move operations retain journals and before images until the final folder scan
  and IndexedDB link snapshot are durable. Exact rollback refuses a later external edit; restart reports pending
  recovery without expiring it.
- Watch events expose only authority and generation, coalesce at 250 milliseconds, and request a full scan. The broad
  renderer-path project commands and loopback asset server are removed; the unrelated EPUB Save dialog remains.
- Chromium and PWA transfer uses an explicit ZIP limited to `book.txt`, `.md` chapters, and `research/`, with bounded
  entry count and bytes plus unsafe-name and collision refusal. It retains no browser directory handle.

**Not verified**

- No retained UI behaviour uses the Prose parser, index writer, v3 persistence session, or native synchronization
  adapter yet. P2-01 owns that adoption.
- EPUBCheck and Ace were not run because their optional tools are absent. No Prose output has run through Scribe.
- The headless CSP path and real temporary Linux folders were tested, but a clicked native dialog, packaged watcher
  delivery, disk-full injection, a real packaged Tauri window, manual accessibility, and reading-system behaviour were
  not tested.

**Gotchas for the next session**

- The retained shell is still a generic web studio. Its v2 stores remain only for compatibility and recovery; callers
  must use `Store.openBooks` and the v3 book APIs before claiming Prose persistence behaviour.
- The physical version stores are `bookVersions` and `bookVersionFiles`; the inherited `versions` name remains occupied.
- `src/app/persistence.js` remains the generic inherited adapter. Prose callers use the separate
  `src/app/book-persistence.js` session; `P2-01` owns editor adoption.
- `.plainchant-prose-recovery/` is a reserved native recovery area. A warning means an interrupted or unfinalized
  operation remains. Do not delete it automatically; P2-01 needs to surface finalize or exact rollback.
- The retained generic desktop folder buttons now explain that broad project-folder access is disabled. They do not
  call removed path-based commands. `ProseNativeFolders` is the supported Tauri adapter.
- P1-06 deliberately does not make browser directory handles part of the Prose contract. `BookArchive` is the browser
  transfer boundary; inherited generic studio folder code remains outside the callable Prose session until P2-01.
- Installed external binaries and loopback tests can be blocked by the workspace sandbox even when present. Record
  that refusal separately from an absent optional oracle.

## Next steps

1. The maintainer enables GitHub private vulnerability reporting and confirms it before `P5-07`.
2. Start P2-01 by adapting the inherited editor to the Prose book session, including folder relink, recovery warning,
   conflict choices, and visible reasons when colour hints disengage.

## Open questions for maintainers

- None. Q-001 through Q-006 are answered in DECISIONS.

## Session log

Earlier completed sessions are in [the November 2026 archive](archive/SESSION_LOG_2026_11.md).

### Session 13: 2026-11-15: implement confined native book folders

**Contributor:** Maintainer and Codex

**Goal:** Complete P1-07 with dialog-only authority, Linux folder confinement, bounded native fingerprints, exact
mutation preflights, recoverable native operations, and coalesced watch notifications.

**Done:** P1-07 implementation and documentation; commit and push remain maintainer-controlled.

**Changed:** Replaced the inherited broad Tauri project-folder commands and loopback asset server with a process-local
selected-root registry and narrow book commands. Added `src-tauri/src/native_books.rs` for managed-set validation,
Linux `openat2` confinement, native SHA-256 scans, limits, atomic create and replacement, recoverable delete and move,
rollback, finalization, and watch coalescing. Added `src/app/tauri-book-folder.js` as the path-free adapter. Extended
`ProseBookSync` to accept native scan descriptors, read disk-only content lazily, retain operation identifiers through
the final scan and IndexedDB snapshot, and finalize only after both are durable. Disabled legacy Tauri project-folder
buttons while retaining explicit browser folder behavior and the unrelated EPUB Save dialog.

**Decisions:** D-008 is accepted with the selected-root and fail-closed Linux contract. D-023 records same-filesystem
recovery material, exact reverse rollback, finalization timing, restart warnings, and no automatic expiry.

**Verified:** `npm test` passed 257/257. `npm run test:browser` passed starter 1/1 and storage, persistence, sync, and
transfer 32/32 in Google Chrome 157.0.8103.78. `npm run tauri:test` passed 16/16 on temporary Linux folders, including
path, symlink, collision, ownership, permission, limit, fingerprint, interruption, rollback, and coalescing cases.
Both P1-07 mutations failed for their intended reasons and were restored. The final documentation result is recorded
in Current state.

**Not verified:** A clicked native dialog, actual Tauri watcher event delivery through a packaged webview, disk-full
injection, other desktop platforms, P2-01 UI adoption, or a packaged application window.

**Problems / surprises:** The sandbox blocked Cargo index access until the approved dependency download ran outside
the sandbox. It also blocked the loopback browser harness until the maintained browser command used its approved
unsandboxed execution.

**Corrections:** Native scan descriptors now avoid reading every file into the webview. Recovery finalization follows
the durable final snapshot instead of each rename. Legacy renderer paths no longer restore filesystem authority.

**Left undone:** P2-01 editor adoption and visible native recovery or conflict UI, packaged-window validation,
disk-full injection, EPUB handoff, and release checks.

**Next session should start with:** Inspect P2-01 and propose the editor-to-book-session adoption slice before editing.

### Session 12: 2026-11-15: implement folder synchronization decisions and browser transfer

**Contributor:** Maintainer and Codex

**Goal:** Complete P1-06 with exact three-way folder decisions, conflict-preserving writes, path-free link metadata,
and explicit browser transfer while leaving real native authority to P1-07.

**Done:** P1-06.

**Changed:** Replaced the inherited single-file timestamp decision in `src/filesync.js` with a bounded multi-file
three-way planner. Added `src/app/book-sync.js` for Web Crypto fingerprints, one-live-folder ownership, exact
preflights, CRLF-preserving writes, version-before-load behavior, and an abstract native adapter. Added
`src/book-archive.js` for explicit bounded ZIP import and export. Folder-link validation accepts the new exact and
canonical fingerprints while preserving legacy metadata as non-authoritative data.

**Decisions:** D-022 records canonical newline handling, exact and canonical SHA-256 identities, whole-folder pause,
conflict choices, additions, deletion, rename evidence, path collisions, interrupted progress, process-only authority,
and the explicit browser package limits.

**Verified:** `npm test` passed 256/256. `npm run test:browser` passed the starter 1/1 and the IndexedDB, persistence,
folder-sync, and transfer 32/32 cases in Google Chrome 157.0.8103.78. The browser cases prove Web Crypto hashing,
newline preservation, version-before-load, simultaneous-change pause, a late exact-fingerprint refusal, one live
folder owner, ZIP byte preservation, and traversal refusal. Removing the final exact preflight produced the expected
targeted failure before restoration. The final documentation, Rust, and repeat-browser results are recorded in
Current state.

**Not verified:** A real Tauri folder, native dialogs, symlink confinement, atomic replacement, watcher behavior, the
retained UI's adoption, visible conflict choices, a packaged window, other browsers, or assistive technology.

**Problems / surprises:** The workspace sandbox refused loopback binding, so the maintained browser suite required its
approved unsandboxed command. The retained generic folder code persists paths and browser handles in legacy v2 data;
the new Prose session neither calls nor imports that authority.

**Corrections:** Canonicalization preserves trailing newlines and empty content instead of inheriting Scribe's
exactly-one-final-newline rule. A second preflight runs immediately before each replacement after the group preflight.
Browser package text retains a UTF-8 byte-order mark.

**Left undone:** P1-07 native commands and real-folder evidence, P2-01 editor and conflict UI adoption, service-worker
workflow tests, and release checks.

**Next session should start with:** Claim P1-07 and draft the process-local selected-root and command schemas against
`ProseBookSync` before replacing retained broad Rust project-folder commands.

### Session 11: 2026-11-15: implement autosave and crash reconciliation

**Contributor:** Maintainer and Codex

**Goal:** Complete P1-05 with an exact multi-file recovery state machine, debounced durable saves, an emergency text
buffer, explicit deletion, and real forced-close evidence.

**Done:** P1-05.

**Changed:** Added `src/book-recovery.js` for versioned per-book emergency records, exact reconciliation, and 30-day
retention status. Added `src/app/book-persistence.js` for the 250-millisecond emergency write, 1,500-millisecond
IndexedDB autosave, lifecycle flushes, generation-safe writes, immediate binary persistence, pending-intent pause,
revision-only tab notices, soft delete, restore, and confirmed permanent deletion. The store now refuses removal of
the last durable chapter and can remove all local records owned by an explicitly confirmed book.

**Decisions:** D-021 records exact base-revision recovery, omission versus deletion, localStorage failure behavior,
generation ordering, revision-only broadcasts, the guaranteed 30-day restore period, and the rule that expiry never
deletes automatically.

**Verified:** `npm test` passed 243/243. Two consecutive `npm run test:browser` runs passed the 1/1 starter smoke and
25/25 persistence cases in Google Chrome 157.0.8103.78. The browser suite covered two dirty chapters, a forced target
close and restart,
in-flight typing, empty text, last-chapter refusal, pending intents, immediate binary storage, localStorage refusal,
failed-transaction retention, soft-delete restore, explicit permanent deletion, two-tab revision serialization,
corruption, upgrade, and actual quota behavior. Clearing emergency text before a failed transaction produced the
expected targeted failure before restoration. The documentation result is recorded in Current state after the final
run.

**Not verified:** Prose editor adoption, visible recovery choices, real folder sync, native permissions, a packaged
Tauri window, other browsers, or assistive technology.

**Problems / surprises:** A queued save initially captured edits in a later microtask, so typing immediately after a
manual save joined the earlier snapshot. Starting the first save synchronously and serializing only later saves makes
the generation boundary exact. The browser runner also needed a fresh target after deliberately closing its first
page.

**Corrections:** Permanent deletion removes auxiliary records and versions with the book. An explicit browser case
proves a failed IndexedDB transaction retains emergency text. Binary research bypasses localStorage and begins a
durable commit immediately.

**Left undone:** P1-06 folder synchronization, P1-07 native folder commands, P2-01 editor adoption, visible recovery
UI, EPUB handoff, and release evidence.

**Next session should start with:** Claim P1-06 and draft the folder snapshot, fingerprint, newline, conflict, rename,
missing-file, and browser import or export contract before changing the retained folder adapter.

### Session 10: 2026-11-15: adopt the multi-file IndexedDB schema

**Contributor:** Maintainer and Codex

**Goal:** Complete P1-04 with a durable multi-file schema, exact concurrent-write rule, recoverable intents, and
non-destructive failure states before connecting Prose editing to persistence.

**Done:** P1-04.

**Changed:** Added `src/store-schema.js` for pure record validation, file and book limits, exact file comparisons, and
failure classification. Upgraded `plainchant_prose` to version 3 with separate book, file, UI, version, version-file,
intent, target, folder-link, and handoff stores while preserving inherited v2 stores. Added monotonic-revision book
transactions, atomic versions, prepared and applied intent resolution, auxiliary-record ownership, and read-only
recovery inspection. Added Node rules and a dependency-free Chrome DevTools pipe runner for real IndexedDB checks.

**Decisions:** D-020 records legacy preservation, physical store names, revision serialization, exact intent states,
structured recovery, storage limits, fingerprinted binary research, non-authoritative folder metadata, and the P1-05
boundary for autosave, emergency text, and 30-day expiry.

**Verified:** `npm test` passed 238/238. Two consecutive `npm run test:browser` runs passed the 1/1 starter smoke and
13/13 IndexedDB cases in Google Chrome 157.0.8103.78. The browser suite covered fresh v3 creation, v2 preservation,
forced-upgrade rollback, atomic version abort, intent recovery, auxiliary stores, corrupt records, unknown store data,
newer schema, a two-tab race, blocked upgrade, version-change closure, and actual quota exhaustion under a 1 KiB
override. Removing the revision refusal produced the expected stale-write failure before restoration. The documentation
result is recorded in Current state after the final run.

**Not verified:** UI adoption, debounced autosave, emergency-buffer recovery, 30-day expiry, real folder sync, native
permissions, or deletion UX.

**Problems / surprises:** The inherited `versions` store required distinct Prose physical names. Chromium quota
override must be sent on the page DevTools session. The starter `--dump-dom` probe could wait indefinitely for storage
startup under virtual time, so its readiness wait is bounded while the dedicated IndexedDB suite verifies storage
directly.

**Corrections:** Binary research equality requires a content fingerprint, folder-link records reject persisted path or
grant authority, auxiliary writes verify their book in the same transaction, and unknown or incomplete store topology
enters read-only recovery without deletion.

**Left undone:** P1-05 autosave, emergency reconciliation, expiry, and v3 UI adoption; P1-06 folder synchronization;
P1-07 native folder commands.

**Next session should start with:** Claim P1-05 and draft the emergency-buffer and dirty-file state machine against
the v3 book revision and intent APIs before changing retained `src/app/persistence.js`.

### Session 9: 2026-11-15: implement lossless book-index splices

**Contributor:** Maintainer and Codex

**Goal:** Complete P1-03 without adding comment syntax, normalizing hand-edited `book.txt` source, or keeping a second
book-index grammar inside the parser.

**Done:** P1-03.

**Changed:** Added `src/book-index.js` as the immutable source-only reader and order planner, added `src/splice.js` as
the strict UTF-16 range primitive, and made `Prose.parseBook` consume the index result. Added tests for exact inverse
reordering, untouched source, CRLF, BOM, astral offsets, duplicate text identities, unknown-line ambiguity, stale
source, invalid permutations, overlap, size limits, purity, and source-map immutability.

**Decisions:** D-019 records range identities, complete permutations, fixed intervening source, one recognized-span
splice, exact stale-source comparison, and refusal when an unknown line lies inside the moved records. Comment-like
lines remain unknown conflicts under D-018 rather than gaining v0.1 comment semantics.

**Verified:** `npm test` passed 229/229. A no-op returned no edits, an order and its inverse reproduced every original
code unit, and exact prefix and suffix comparisons covered metadata and trailing source. Weakening stale-source refusal
produced the expected targeted failure before restoration. The final documentation and syntax results are recorded in
Current state.

**Not verified:** Binder or editor integration, browser undo, IndexedDB transactions, real folder writes, multi-file
changes, EPUB handoff, and real reading-system behaviour.

**Problems / surprises:** The retained assertion helper does not expose Node's `assert.notEqual`; the test now uses an
equivalent strict inequality assertion. Reusing the parser's embedded book grammar would have created two owners, so
the parser now delegates to `BookIndex.read` and adds only folder-level diagnostics.

**Corrections:** The roadmap's inherited word “comments” now says “comment-like unknown lines,” matching the approved
P1-01 rule that `book.txt` has no comment syntax. Unknown source inside a moved span blocks that operation; unknown
source outside it remains byte-identical.

**Left undone:** P1-04 durable working-copy schema, later multi-file transactions, UI integration, folder sync, and
handoff output.

**Next session should start with:** Claim P1-04 and settle record keys, transaction ownership, quota and corruption
states, version retention, two-tab coordination, and upgrade recovery before changing inherited persistence code.

### Session 8: 2026-11-14: implement the pure Prose parser

**Contributor:** Codex

**Goal:** Complete P1-02 as a pure, immutable parser and safe renderer without coupling source interpretation to the
browser shell or persistence.

**Done:** P1-02.

**Changed:** Added `src/prose.js` with whole-book and isolated-chapter entry points, exact UTF-16 ranges, metadata and
path conflict detection, chapters, scenes, synopses, headings, paragraphs, quotes, emphasis, notes, boneyards,
footnotes, diagnostics, an export gate, and escaped HTML rendering. Added fixture-exact, hostile-input, encoding,
immutability, purity, size-limit, and precedence tests.

**Decisions:** Parser results are deeply immutable and use a 5,242,880 UTF-16-code-unit default per-file limit.
Recognized closed notes and boneyards outrank block-looking lines. Footnote-definition content treats note and
boneyard marks as diagnosed literal text. Preview renders only footnote labels with exactly one reference and one
definition; ambiguous labels remain literal.

**Verified:** `npm test` passed 218/218. The parser matched every normative fixture diagnostic and export gate; 200
deterministic bounded hostile strings returned in-range models; raw writer HTML stayed escaped; and pure-boundary
checks found no browser, storage, native, or Node dependency. Disabling less-than escaping produced the expected
214/215 failure before restoration. The documentation result is recorded in Current state after the final run.

**Not verified:** Browser integration, editor behavior, `book.txt` splices, IndexedDB, native folders, EPUB output,
performance on the later 120,000-word fixture, or reading-system behavior.

**Problems / surprises:** A first block pass could interpret heading, scene, quote, list, and definition-shaped lines
inside multiline private source. Applying the hidden ranges to block recognition restored the specified precedence.
Ambiguous footnotes also needed a renderer gate so preview did not imply a winner.

**Corrections:** The block scanner masks recognized notes and boneyards while preserving source offsets. A preliminary
hidden scan prevents definition-shaped lines inside private source from becoming footnotes, while definition content
keeps private delimiters literal with a diagnostic.

**Left undone:** P1-03 index splices, durable working copy, folder synchronization, writing UI, and handoff output.

**Next session should start with:** Claim P1-03, define the exact ordered-region range in `book.txt`, and prove that
metadata spacing, unknown lines, newline style, and all untouched bytes survive an order edit.

### Session 7: 2026-11-14: specify the Prose source grammar

**Contributor:** Maintainer and Codex

**Goal:** Complete P1-01 by turning the approved source choices into a normative, executable contract without
implementing the parser early.

**Done:** P1-01.

**Changed:** Added `docs/SOURCE_FORMAT.md` for `book.txt`, chapter blocks, inline marks, malformed recovery,
diagnostics, and the export gate; recorded D-018; added seven fixture cases with valid, conflicting, malformed,
encoding, Unicode, and precedence examples; and added four dependency-free consistency checks to `npm test`.

**Decisions:** Required metadata is Title, Author, and Language. Publish Date, Publisher, and Series are optional.
Unknown metadata remains a conflict until rejected or rewritten as generalized custom metadata. Duplicate metadata has
no automatic winner, stays visible while editing, and blocks export until the writer chooses. Every export reruns the
complete conflict check. Source ranges use half-open UTF-16 code-unit offsets.

**Verified:** `npm test` passed 202/202, including manifest completeness, exact source slices, diagnostic/export-gate
agreement, and approved-feature coverage. Shortening one recorded range produced the expected 201/202 failure before
the fixture was restored. The documentation result is recorded in Current state after the final run.

**Not verified:** Parser output, rendering, editor integration, book-index splices, browser workflows, native folder
behaviour, EPUB handoff, or reading-system behaviour.

**Problems / surprises:** Encoding fixtures need CRLF and byte-order-mark evidence that remains visible in code
review. Those isolated sources live as escaped JSON strings; every ordinary fixture remains a physical book file.

**Corrections:** The fixture harness distinguishes contract consistency from parser correctness and requires every
physical source file to appear in its case manifest. Unicode normalization and astral offset cases prevent accidental
byte or code-point range semantics.

**Left undone:** The P1-02 parser, P1-03 index splice writer, durable working copy, folder synchronization, writing UI,
and handoff implementation.

**Next session should start with:** Claim P1-02, define the parser module boundary from `docs/SOURCE_FORMAT.md`, then
make the minimal and full fixtures pass before implementing malformed recovery.

### Session 6: 2026-11-14: adapt the foundation harness

**Contributor:** Codex

**Goal:** Complete P0-06 without compiling unimplemented Prose domain claims into the retained foundation tests.

**Done:** P0-06 and Phase 0.

**Changed:** Added maintained `test:browser` and `tauri:test` package commands; added a dependency-free Chromium runner
that uses a disposable profile, temporary origin, and the exact Tauri CSP; renamed the runtime example-book test helper
as an explicitly test-only EPUB fixture; removed inherited source-roadmap citations from retained tests; rewrote the
optional EPUBCheck and Ace suites so installed tools no longer call P0-05 modules; and added a structure guard for the
adapted harness.

**Decisions:** No new product decision. The browser runner remains a foundation smoke until Phase 1 adds Prose
workflows. Node 18 is the declared minimum because the maintained commands use only Node platform APIs.

**Verified:** `npm test` passed 198/198 with LibreOffice running and EPUBCheck and Ace reporting named absences; the
explicit all-oracle skip run passed 197/197 with three named `not run` reasons; `npm run test:browser` passed 1/1 in
Chrome 157 under the exact CSP; a deliberate page-title mutation produced the expected browser failure; and
`npm run tauri:test` passed 5/5. The documentation result is recorded in Current state after the final run.

**Not verified:** EPUBCheck, Ace, a packaged Tauri window, Prose grammar or persistence behaviour, manual accessibility,
or reading-system output.

**Problems / surprises:** The optional suites appeared green only because their tools were absent. If installed, both
would have referenced modules removed by P0-05. The temporary CSP smoke also depended on an environment-owned browser
library and was not a repository command. A final browser rerun exposed that a four-second virtual-time budget could
dump the DOM before the asynchronous probe finished.

**Corrections:** Optional suites now exercise retained handoff seams only. The browser runner uses no project runtime
dependency and fails on runtime errors, policy violations, missing Stage content, a missing bridge, or the wrong title.
Its virtual-time budget is ten seconds with a 45-second process limit; two consecutive final runs passed.

**Left undone:** The complete Prose source grammar, parser, book model, durable working copy, browser workflows, native
folder confinement, and all later domain implementation.

**Next session should start with:** Claim P1-01, read the BRIEF grammar examples and D-010/D-011, then specify ambiguous
syntax and malformed-input recovery in fixtures before writing parser code.

### Session 5: 2026-11-14: trim the Scribe foundation

**Contributor:** Codex

**Goal:** Complete P0-05 as one reviewable removal pass while preserving the foundation seams named by the roadmap.

**Done:** P0-05.

**Changed:** Removed the Scribe-only publication, reader, device, layout, cover, font, accessibility-publication,
store-checking, NCX-control, preview-server, QR, file-association, event-capability, and manual surfaces. Simplified the
home, help, problems, starter-project, and EPUB export paths to truthful retained behaviour. Added negative structure
coverage for every removed source and test file plus the discarded HTML, CSS, Tauri, and capability surfaces.

**Decisions:** D-017 continues to govern the retained generic Stage. The network preview and EPUB Stage disappeared;
the existing local Stage still requires its generated interaction bridge under the exact page CSP.

**Verified:** `npm test` passed 197/197; Rust passed 5/5; headless Chrome 157 loaded the generic starter Stage and
bridge under the exact CSP with no console error or policy violation. The documentation result is recorded in Current
state after the final run.

**Not verified:** EPUBCheck, Ace, a packaged Tauri window, Prose grammar or persistence behaviour, manual accessibility,
or reading-system output.

**Problems / surprises:** Publication concerns crossed the HTML, classic-script graph, pure modules, service worker,
native command registry, Cargo features, capabilities, CSS, help, fixtures, and test runner. A test-only EPUB fixture
was needed to retain package coverage without keeping the runtime example book.

**Corrections:** The removal guard now names every discarded source and test file and representative UI and native
boundaries. Current documents describe the trimmed foundation and leave full suite adaptation to P0-06.

**Left undone:** Prose test adaptation, maintained browser runner, source grammar, book model, durable working copy,
and all later domain implementation.

**Next session should start with:** Claim P0-06, classify every retained test as generic foundation evidence or a
Prose contract, then add the maintained disposable-profile Chromium runner.

### Session 4: 2026-11-13: rename and harden the inherited shell

**Contributor:** Codex

**Goal:** Complete P0-04 without mixing in the Scribe feature-removal scope owned by P0-05.

**Done:** P0-04.

**Changed:** Renamed product, storage, cache, package, manifest, project-marker, oracle-variable, Rust crate, Tauri,
desktop-template, and user-facing application identifiers; replaced the public Tauri global with an internal invoke
and event bridge; added the strict D-017 CSP and Stage nonce; added guards against inherited machine identifiers and
nonce-copying imported scripts.

**Decisions:** D-017 records why sandboxed Stage CSS remains inline and why only the generated interaction bridge may
carry the CSP nonce. D-008 remains proposed because complete folder confinement belongs to P1-07.

**Verified:** `npm test` passed 314/314; Rust passed 15/15; headless Chrome 157 loaded the example Stage and bridge
under the exact CSP with no console or policy error. External oracles and loopback tests required execution outside
the workspace sandbox.

**Not verified:** EPUBCheck, Ace, a packaged Tauri window, Prose grammar or persistence behaviour, manual accessibility,
or reading-system output.

**Problems / surprises:** The first strict policy blocked inherited inline Stage styles and its generated bridge. The
runtime smoke test exposed the failure even though the structure suite was green.

**Corrections:** Inline Stage CSS is permitted inside its sandboxed frame; imported scripts are stripped; the one
post-sanitization bridge carries the nonce. Negative tests prove that imported markup cannot authorize itself by
copying the known nonce.

**Left undone:** Scribe publication-feature removal, manual replacement, Prose test adaptation, browser-runner
adoption, and all Prose domain implementation.

**Next session should start with:** Claim P0-05, map each removal through HTML, app script, pure module, persistence,
native command, service-worker entry, and test before deleting it.
