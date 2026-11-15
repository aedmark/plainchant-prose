# Session handoff

Read this first when resuming work. Rewrite Current state when the repository changes materially or work pauses. The
session log is append-only; permanent rules live in the linked owner documents.

Protocol: [AGENTS.md](../AGENTS.md). Plan: [ROADMAP.md](../ROADMAP.md). Architecture:
[ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [DECISIONS.md](DECISIONS.md). Tests: [TESTING.md](TESTING.md).
Security: [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md). History: [archive/](archive/README.md).

## Current state

_Last updated: 2026-11-14, session 7, on `master` tracking `origin/master`: P1-01 defines the complete Prose source
grammar and normative fixtures; parser implementation begins at P1-02._

**Session owner:** None.

**Where things stand:** `BRIEF.md` remains the maintainer-owned source. Plainchant Prose uses `.md` chapters, standard
`##` through `######` headings, an ignored optional `research/` directory, IndexedDB-only writing history in v0.1,
Tauri-only linked folders, and Linux desktop plus Chromium browser or PWA support. `LICENSE` contains the supplied
AI-assisted MIT terms adapted for Plainchant Prose and names Andrew Edmark and Arantor as the Humans. The private
security channel is GitHub private vulnerability reporting, which the maintainer will enable on the existing
repository. Git uses `master` and the GitHub `origin`. The application foundation comes from Plainchant Scribe commit
`e2b22186a481afb6b0180d0883ce21d393ae7352`; P0-04 renames its identifiers and hardens its page boundary. P0-05
removes Scribe-only publication, reader, layout, cover, font, checking, preview-server, file-association, and help
surfaces. P0-06 adapts the retained tests, removes dormant oracle references to discarded modules, and adds maintained
browser and Rust commands. P1-01 adds the normative `docs/SOURCE_FORMAT.md`, D-018, and seven fixture cases with exact
UTF-16 source ranges and diagnostics. The retained shell still has generic studio concepts; no Prose parser or book
model exists yet. The complete provenance and removal map are in `docs/archive/plainchant-lineage.md`.

**Verified** (2026-11-14; Node 22.23.5, Rust and Cargo 1.99.1, Google Chrome 157.0.8103.78, Python 3.14.10)

| Suite | Result |
| --- | --- |
| `npm test` | **202/202 passed**; four P1-01 fixture checks passed, LibreOffice ran, EPUBCheck and Ace reported `not run` with reasons |
| Fixture-range mutation | **Expected failure, 201/202 passed** after shortening one recorded range; fixture restored |
| Explicit all-oracle skip run | **197/197 passed**; EPUBCheck, Ace, and LibreOffice each reported `not run` with its configured reason |
| `npm run test:browser` | **1/1 passed twice** after the final timing adjustment, in disposable Chrome profiles under the exact CSP |
| Browser-runner mutation | **Expected failure** for the deliberately changed page title; production title restored |
| `npm run tauri:test` | **5 passed, 0 failed** |
| `python3 tools/check_docs.py` | **0 errors, 0 warnings in 14 files** |

**What works**

- The original brief is preserved unchanged.
- The repository contains the selected licence text with the requested project and contributor names.
- The trimmed static shell retains multi-file projects, Markdown import, EPUB packaging, versions, library, find,
  offline assets, generic Stage rendering, IndexedDB, native folders, and the Node and Rust harnesses.
- Application identity and persistent keys belong to Plainchant Prose; a structure guard rejects inherited machine
  identifiers in runtime paths and files.
- The native page has a strict local-only CSP, no public Tauri global, and a tested internal invoke bridge.
- Structure checks reject the removed Scribe-only source, tests, HTML controls, CSS surfaces, native commands,
  capabilities, EPUB association, and inherited manual.
- `npm test`, `npm run test:browser`, and `npm run tauri:test` are maintained entry points for the retained foundation;
  optional oracles distinguish a named skip from a pass.
- The source-format contract settles required and optional metadata, generalized custom keys, user-resolved
  duplicates, index safety, chapter syntax, malformed recovery, precedence, exact ranges, and export blockers.
- Seven normative fixture cases cover valid books, conflicts, malformed source, unsupported literal Markdown,
  escaping, line endings, a byte-order mark, Unicode normalization, and astral UTF-16 offsets.
- The blueprint separates observed sibling-repository evidence, accepted product choices, proposed implementation
  choices, and the resolved maintainer questions.
- The roadmap puts safe multi-file storage before UI expansion and places the Scribe handoff before secondary writing
  aids.

**Not verified**

- No parser, book-index reader, retained UI behaviour, recovery path, or folder workflow implements the Prose source
  grammar yet.
- EPUBCheck and Ace were not run because their optional tools are absent. No Prose output has run through Scribe.
- The headless CSP path was tested, but a real packaged Tauri window, manual accessibility, and reading-system
  behaviour were not tested.

**Gotchas for the next session**

- `BRIEF.md` contains an unavailable embedded-plan marker. The maintainer called it noise and instructed the blueprint
  to ignore it on 2026-11-12.
- The retained shell is still a generic web studio. P1-02 must implement the fixtures without weakening their
  conflicts into automatic choices.
- The D-017 Stage nonce is an authorization marker, not a secret. The generic Stage strips imported scripts before
  inserting its marked interaction bridge.
- `test/epub-fixture.js` is test-only. It preserves direct coverage for retained EPUB packaging without restoring an
  EPUB-as-project runtime model.
- Installed external binaries and loopback tests can be blocked by the workspace sandbox even when present. Record
  that refusal separately from an absent optional oracle.
- Sibling repositories are separate Zones and remain read-only without a new explicit request.

## Next steps

1. The maintainer enables GitHub private vulnerability reporting and confirms it before `P5-07`.
2. Start P1-02 with a pure parser that satisfies the normative source fixtures and returns exact UTF-16 ranges.

## Open questions for maintainers

- None. Q-001 through Q-006 are answered in DECISIONS.

## Session log

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

### Session 3: 2026-11-13: adopt the Scribe foundation

**Contributor:** Maintainer and Codex

**Goal:** Use Plainchant Scribe as the known-green foundation and preserve exact lineage before adaptation.

**Done:** P0-03.

**Changed:** Copied the pinned Scribe static app, test harness, fonts, icons, Tauri shell, linked manual, and round-trip
tool; added the exact copied-file manifest and removal map; added Prism's notice to the Prose licence; updated current
architecture, testing, security, roadmap, README, and handoff claims.

**Decisions:** D-016 establishes Scribe as the primary foundation and Plainchant as the later writing-source reference.

**Verified:** Every copied blob matches Scribe commit `e2b22186a481afb6b0180d0883ce21d393ae7352`;
`npm test` passed 313/313; the Rust suite passed 15/15. Installed external executables and temporary loopback servers
required execution outside the workspace sandbox.

**Not verified:** Prose behaviour, EPUBCheck, Ace, browser workflows, packaged desktop behaviour, or manual release
claims.

**Problems / surprises:** The first archive selection omitted a linked manual and the test-only round-trip helper.
The inherited structure test also required Prism's third-party notice. The sandbox refused QR tools and loopback
sockets despite their presence.

**Corrections:** Added the omitted dependency closure without copying Scribe's active project documentation or Git
history. The lineage record names each copied file and the reasons for retaining or removing it.

**Left undone:** Product rename, CSP and global-Tauri hardening, Scribe feature removal, Prose test adaptation, and all
Prose domain implementation.

**Next session should start with:** Claim P0-04, inventory every inherited identifier, then rename and harden the shell
without mixing in P0-05 feature removal.

### Session 2: 2026-11-13: settle blueprint choices and add the licence

**Contributor:** Maintainer and Codex

**Goal:** Answer the six open design choices and adapt the supplied AI-assisted MIT licence.

**Done:** `P0-02`; design questions Q-001 through Q-006.

**Changed:** Added `LICENSE` and `.gitignore`; recorded `master`, the GitHub `origin`, and baseline commit `5f04650`;
accepted D-007 and D-010; added D-011 through D-015; resolved T-001; updated the roadmap, architecture, testing,
security, contribution, README, AGENTS, and handoff claims.

**Decisions:** Standard `##` through `######` headings; optional ignored `research/`; IndexedDB-only histories in v0.1;
Tauri-only linked folders; Linux desktop and Chromium browser or PWA support; AI-assisted MIT terms with Andrew Edmark
and Arantor as the Humans; GitHub private vulnerability reporting as the maintainer-enabled security channel.

**Verified:** `python3 tools/check_docs.py`: 0 errors, 0 warnings in 13 files.

**Not verified:** Licence interpretation by counsel; every application behaviour; no code exists.

**Problems / surprises:** Q-006 combined licence and reporting contact; separate decisions record each part.

**Corrections:** Research and platform conventions are now decided. Earlier current-state text that called them open is
superseded by this session.

**Left undone:** Enabling private vulnerability reporting, source copy, and all implementation.

**Next session should start with:** Claim `P0-03` and record the exact Plainchant source commit before copying.

### Session 1: 2026-11-12: adopt the Plainchant Prose blueprint

**Contributor:** Codex

**Goal:** Read the product brief and suite repositories, learn the Manifold template, and fully adopt it as an
implementation blueprint.

**Done:** `P0-01`.

**Changed:** Replaced template placeholders across README, AGENTS, and active docs; added ROADMAP and the archive
index; preserved BRIEF; recorded confirmed maintainer choices and unresolved questions.

**Decisions:** D-001 through D-010 recorded; D-007, D-008, and D-010 remain proposed.

**Verified:** `python3 tools/check_docs.py`: 0 errors, 0 warnings in 13 files.

**Not verified:** Every application and cross-application behaviour; no code exists.

**Problems / surprises:** The folder contained an empty `.git` directory and omitted ROADMAP and `docs/archive/` from
the otherwise complete Manifold copy. The brief's embedded plan was unavailable and the maintainer directed that it be
ignored.

**Corrections:** Plainchant Prose replaces the brief's working name Plainchant Draft. The maintainer selected `.md` from
the brief's chapter-extension alternatives.

**Left undone:** Git initialization, licence, unanswered product questions, source copy, and all implementation.

**Next session should start with:** Read Current state, get the relevant maintainer answer, then claim one roadmap item.
