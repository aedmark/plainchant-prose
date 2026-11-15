# Session handoff

Read this first when resuming work. Rewrite Current state when the repository changes materially or work pauses. The
session log is append-only; permanent rules live in the linked owner documents.

Protocol: [AGENTS.md](../AGENTS.md). Plan: [ROADMAP.md](../ROADMAP.md). Architecture:
[ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [DECISIONS.md](DECISIONS.md). Tests: [TESTING.md](TESTING.md).
Security: [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md). History: [archive/](archive/README.md).

## Current state

_Last updated: 2026-11-15, session 9, on `master` tracking `origin/master`: P1-03 implements the lossless `book.txt`
reader, strict range splices, and source-preserving order edits; IndexedDB schema work begins at P1-04._

**Session owner:** None.

**Where things stand:** `BRIEF.md` remains the maintainer-owned source. Prose uses `.md` chapters, an ignored optional
`research/` directory, IndexedDB-only history, Tauri-only linked folders, and Linux desktop plus Chromium browser or
PWA support. The renamed and trimmed Scribe foundation comes from commit
`e2b22186a481afb6b0180d0883ce21d393ae7352`; its provenance is in `docs/archive/plainchant-lineage.md`. P1-01 defines
the source grammar and fixtures. P1-02 parses immutable ranged books and renders escaped preview HTML. P1-03 adds the
sole lossless `book.txt` reader, strict splices, and stale-source-checked order planning. The retained shell still has
generic studio concepts; Prose domain modules are not connected to its UI or persistence.

**Verified** (2026-11-15; Node 22.23.5, Python 3.14.10; retained browser and Rust results below are from 2026-11-14)

| Suite | Result |
| --- | --- |
| `npm test` | **229/229 passed**; P1-03 exact preservation and refusal checks passed, LibreOffice ran, EPUBCheck and Ace reported `not run` with reasons |
| Stale-source mutation | **Expected failure** after weakening the exact ordered-source comparison; implementation restored |
| `npm run test:browser` | **1/1 passed twice** after the final timing adjustment, in disposable Chrome profiles under the exact CSP |
| `npm run tauri:test` | **5 passed, 0 failed** |
| `python3 tools/check_docs.py` | **0 errors, 0 warnings in 14 files** |

**What works**

- Application identity and persistent keys belong to Plainchant Prose; a structure guard rejects inherited machine
  identifiers in runtime paths and files.
- The native page has a strict local-only CSP, no public Tauri global, and a tested internal invoke bridge.
- `npm test`, `npm run test:browser`, and `npm run tauri:test` are maintained entry points for the retained foundation;
  optional oracles distinguish a named skip from a pass.
- The source-format contract settles required and optional metadata, generalized custom keys, user-resolved
  duplicates, index safety, chapter syntax, malformed recovery, precedence, exact ranges, and export blockers.
- Seven normative fixture cases cover valid books, conflicts, malformed source, unsupported literal Markdown,
  escaping, line endings, a byte-order mark, Unicode normalization, and astral UTF-16 offsets.
- `Prose.parse` returns immutable ranged metadata, parts, chapters, scenes, printable blocks, notes, boneyards,
  footnotes, diagnostics, and the complete export gate from an in-memory book map.
- `Prose.parseChapter` supports isolated editor parsing; `Prose.toHTML` escapes writer text, omits recognized private
  source, and leaves ambiguous footnotes literal.
- `BookIndex.read` owns the `book.txt` grammar used by `Prose.parseBook`; it returns immutable metadata, order records,
  exact identities, unknown lines, diagnostics, and source spans.
- `BookIndex.reorder` returns one explicit order-span edit or a structured refusal for stale, incomplete, repeated,
  unknown, or ambiguous input. `Splice.apply` rejects invalid or overlapping ranges before applying any replacement.
- No-op and inverse reorder tests preserve every original UTF-16 code unit, including metadata spacing, CRLF, a byte
  order mark, blank lines, comment-like unknown source outside the changed span, and trailing source.

**Not verified**

- No retained UI behaviour, recovery path, or folder workflow uses the Prose parser and index writer yet.
- EPUBCheck and Ace were not run because their optional tools are absent. No Prose output has run through Scribe.
- The headless CSP path was tested, but a real packaged Tauri window, manual accessibility, and reading-system
  behaviour were not tested.

**Gotchas for the next session**

- `BRIEF.md` contains an unavailable embedded-plan marker. The maintainer called it noise and instructed the blueprint
  to ignore it on 2026-11-12.
- The retained shell is still a generic web studio. P1-04 must define Prose records without treating the inherited
  Scribe store schema as accepted product behaviour.
- Range identities belong to one `book.txt` revision. A caller rereads after applying an accepted P1-03 edit; it never
  reuses the old model.
- The D-017 Stage nonce is an authorization marker, not a secret. The generic Stage strips imported scripts before
  inserting its marked interaction bridge.
- `test/epub-fixture.js` is test-only. It preserves direct coverage for retained EPUB packaging without restoring an
  EPUB-as-project runtime model.
- Installed external binaries and loopback tests can be blocked by the workspace sandbox even when present. Record
  that refusal separately from an absent optional oracle.
- Sibling repositories are separate Zones and remain read-only without a new explicit request.

## Next steps

1. The maintainer enables GitHub private vulnerability reporting and confirms it before `P5-07`.
2. Start P1-04 by designing the multi-store IndexedDB schema, transaction boundary, upgrade refusal, and recovery
   states before adapting the inherited store.

## Open questions for maintainers

- None. Q-001 through Q-006 are answered in DECISIONS.

## Session log

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
