# Testing

This document defines the evidence required as Plainchant Prose is implemented. The repository currently carries
trimmed Scribe-derived Node and Rust suites as foundation checks plus the normative `P1-01` source fixtures. Their
results prove the retained foundation seams, P0-05 removal guards, and fixture consistency; parser behaviour still
waits for `P1-02`.

## Suites

| Suite | Planned file or command | Proves | Does not prove | Needs |
| --- | --- | --- | --- | --- |
| Documentation, current | `python3 tools/check_docs.py` | Active documents agree on IDs, links, paths, placeholders, and handoff shape | Product design is correct or code exists | Python 3 |
| Node foundation and source fixtures, current | `npm test` through `test/run.js` | Retained pure modules, structure, packaging, configured oracles, P0-05 removals, and P1-01 fixture consistency remain green | Prose parsing behaviour, DOM, real IndexedDB, native files, or writing UI | Node and optional external tools |
| Retained Rust foundation, current | `cargo test --manifest-path src-tauri/Cargo.toml` | Retained native unit tests remain green | Prose path policy, native dialogs, or a packaged window | Rust and Cargo |
| Prose unit and structure, planned | Expanded `npm test` | Parser, splice, book, sync, store-rule, structure, and export contracts | DOM, real IndexedDB, native files, or writing UI | Phase 1 implementation |
| Browser foundation, current | `npm run test:browser` | The starter Stage and interaction bridge load under the exact Tauri CSP in Chromium with a disposable profile | Editing workflows, IndexedDB recovery, service-worker upgrades, other browsers, assistive technology, or visible layout | Installed Chrome or Chromium |
| Browser workflows, planned | Expanded `npm run test:browser` | Editor, undo, IndexedDB, recovery, accessibility mechanics, service worker, and main workflows in one headless engine | Other browsers, real assistive technology, or a human-visible layout | Phase 1 implementation |
| Desktop foundation, current | `npm run tauri:test` | Retained path, filename, and decoding helpers pass in Rust | Full Prose confinement, native dialogs, command registration, or a packaged window | Rust and Cargo |
| Desktop shell, planned | Expanded `npm run tauri:test` | Path confinement, size limits, atomic-write rules, permission state, and command registration | Native dialogs and a real packaged window | Phase 1 implementation |
| EPUB oracle, current when configured | Part of `npm test` | Retained handoff fixtures satisfy the observed EPUBCheck version | Future Prose output, Scribe interpretation, or reading-system rendering | Java and EPUBCheck |
| Accessibility oracle, current when configured | Part of `npm test` | Ace can produce a report for the retained EPUB export | Future Prose accessibility or reading-system behaviour | Ace and Chrome or Chromium |
| Scribe compatibility, planned | Dedicated fixture runner from `P3-05` | The recorded Scribe commit imports and re-exports expected structure | Future Scribe versions or visual quality | Sibling repository at recorded commit |
| DOCX oracle, current when configured | Part of `npm test` | LibreOffice conversion output imports with the expected retained structure | Microsoft Word compatibility | LibreOffice |
| Manual release matrix, planned | Procedure in this document | Named workflows worked on named real environments | Untested platforms or repeatability | Maintainer access |

The fast set is `npm test` plus `python3 tools/check_docs.py`. The full foundation set adds
`npm run test:browser`, `npm run tauri:test`, and configured optional oracles. Native-page CSP changes always require
the maintained browser run under the exact configured policy.

## Evidence rules

- HANDOFF owns dated results. This file owns commands and proof boundaries.
- A test result names the commit, operating system, runtime or browser version, and external-oracle version when they
  can affect the claim.
- A suite that cannot find an optional oracle prints "not run" and its reason. It never prints "passed" for a skip
  (D-006).
- A new check is trusted only after a deliberate mutation of the implementation makes it fail for the intended reason.
- Timing evidence records several runs, the fixture size, machine, and distribution; one busy-machine miss is not a
  performance conclusion.
- Cross-Zone tests do not modify a sibling repository. They use its existing command or a detached artifact and record
  the exact commit.

## Before any run

- Read HANDOFF for the current schema, cache, fixture, and oracle state.
- Use fresh temporary folders and disposable browser profiles. Never point an automated test at a writer's book folder,
  normal browser profile, or production IndexedDB origin.
- Cap archive entry count, individual file size, total inflated size, and parser input before hostile fixtures run.
- Preserve manually downloaded oracles and corpora. A reset script must name exactly what it deletes.
- For folder-sync tests, create a dedicated temporary root and assert its canonical path before any deletion.
- Treat the retained commands as foundation evidence until the relevant Phase 1 item adds a Prose domain contract.

## Current checks

```bash
python3 tools/check_docs.py
npm test
npm run test:browser
npm run tauri:test
```

A documentation pass ends with zero errors. Warnings require review and may indicate that HANDOFF needs
consolidation. The retained code suites must end with their own passing summaries. Optional oracles report `not run`
and a reason. The source-fixture checks validate the written contract and exact ranges, not a parser implementation.

## Source grammar fixtures

`test/fixtures/prose-source/` contains seven normative cases for minimal and full books, metadata conflicts, index
conflicts, malformed chapters, delimiter precedence, escaping, CRLF, a byte-order mark, Unicode normalization, and
astral UTF-16 ranges. Each `expected.json` records features, exact source slices, derived expectations, diagnostics,
and its export gate. `test/source-fixtures.test.js` verifies those records without duplicating the parser planned by
`P1-02`.

Every physical source file in a case must appear in its manifest. Encoding-only examples may embed source in JSON so
CRLF and byte-order-mark evidence remains visible in review. Adding or changing grammar updates the normative format,
fixtures, their coverage list, and parser tests in the same change.

## Retained and planned unit checks

```bash
npm test
```

The current runner derives from Scribe. P0-05 trimmed discarded feature suites; P0-06 removed stale source-roadmap
citations and optional-oracle references to discarded modules without losing the retained baseline. Phase 1 suites
must add coverage for:

- grammar precedence, malformed recovery, escaping, half-open source ranges, CRLF, Unicode, and large input;
- byte-preserving range splices and index-order edits;
- multi-file transaction planning, interruption, rollback, and stale-before-image refusal;
- folder conflict states for identical, local-only, disk-only, simultaneous, missing, added, and renamed files;
- IndexedDB schema rules separately from its browser adapter;
- XHTML and archive output at byte and structure levels;
- inherited-name rejection, classic-script duplicate globals, local-only assets, and service-worker list agreement.

Critical generators use property or fuzz cases with bounded input. Parsers and archive readers include hostile inputs
that must return a diagnostic or refusal without throwing an unclassified exception.

## Browser checks

```bash
npm run test:browser
```

The current dependency-free runner uses an installed Chrome or Chromium, a new profile, a temporary HTTP origin, and
the exact CSP from `src-tauri/tauri.conf.json`. It proves that the app starts and its generic Stage bridge loads without
a runtime or policy error. P0-06 validated the runner by changing the page title and observing the expected failure.

Phase 1 expands the same command to cover create, type, undo, save, reload, emergency recovery, binder and corkboard
keyboard movement, preview escaping, find and replace, versions, theme contrast, zoom, focus order, accessible names,
service-worker update, offline reload, quota failures, and interrupted writes.

Browser tests run against Chromium for the v0.1 support claim. Results from another engine remain additional evidence
and do not extend the supported matrix without a later decision (D-013).

## Desktop checks

```bash
npm run tauri:test
```

The current Rust suite covers retained relative-path rejection, canonical directory handling, safe filenames, and
base64 decoding. Phase 1 adds temporary selected-root cases for symlink escape, Unicode and case aliases, permission
revocation, file-count and byte limits, stale fingerprints, atomic replacement, watcher coalescing, and command
registration. A real-window check remains manual.

## Handoff oracles

The handoff suite builds small novel and non-fiction books plus deliberately broken controls.

1. Byte-level tests inspect the ZIP header, stored `mimetype`, CRCs, entry names, duplicate and traversal prevention,
   package manifest, spine, navigation, XHTML well-formedness, and deterministic order.
2. EPUBCheck runs the valid fixtures and broken controls. The result records its exact version.
3. Scribe at a recorded commit imports the valid fixtures. The comparison checks metadata, parts, chapter order,
   scene breaks, emphasis, quotes, links, and notes, then inspects a Scribe export.
4. Before release, a human opens representative output in every available reading system and records visual limits.

EPUBCheck validity, Scribe compatibility, and reading-system appearance remain three separate claims.

## Change-to-check matrix

| Changed area | Minimum checks | Additional evidence |
| --- | --- | --- |
| Documentation only | `python3 tools/check_docs.py` | Read changed claims against BRIEF and owning documents |
| Pure parser or range logic | Unit and structure suites | Mutation plus bounded fuzz or property cases |
| Browser scripts, CSS, or HTML | Unit, structure, and browser suites | Human check at supported widths, zoom, and themes |
| IndexedDB schema or persistence | Unit and browser suites | Upgrade, interruption, quota, two-tab, backup, and recovery rehearsal |
| Folder sync or Tauri command | Unit, browser where relevant, and Rust suites | Real temporary folder on every supported desktop platform |
| EPUB content or package | Unit suite with EPUBCheck and Scribe configured | Real reading-system check before release |
| DOCX output | Unit suite and LibreOffice oracle | Microsoft Word result when available, labelled with version |
| Service worker or cache | Structure and browser offline suites | Upgrade from the last released version |
| Security boundary | Negative and abuse cases for the affected suite | Targeted review of logs, size limits, and recovery |

## Manual checks before a release

- Create a book, link a dedicated real folder, edit two chapters, close during a pending save, reopen, and recover.
- Edit a linked chapter in another editor; confirm Prose refuses automatic overwrite and each conflict choice preserves
  both revisions.
- Navigate, reorder, and undo with keyboard only; inspect focus, announcements, zoom, reduced motion, and both themes.
- Disconnect storage permission and fill a test filesystem; confirm source files and working copy remain recoverable.
- Send novel and non-fiction fixtures to Scribe, inspect their reading order and notes, then export from Scribe.
- Install and upgrade the PWA in Chromium and the desktop package on Linux (D-013).
- Open release EPUBs in available real reading systems. Record the device, application, and version.

## Performance method

`P2-06` creates deterministic books at 60,000, 120,000, and 200,000 printable words, including long chapters, many
short chapters, notes, boneyards, Unicode, and scene cards. Measure parse, first preview, one-keystroke redraw, binder
build, whole-book search, save, and scene movement. Record median and slowest of at least seven warm runs on the
reference environment before choosing budgets. A budget then becomes a test threshold with documented expected noise.

## Known pitfalls

- A parser test that checks rendered words without checking source ranges can miss destructive splice errors.
- A round-trip equality test can pass after both writer and reader normalize the same source; preservation tests compare
  untouched bytes directly.
- Modification times alone do not detect folder conflicts. Tests need fingerprints and coarse-timestamp cases.
- IndexedDB transactions become inactive when asynchronous work occurs between opening a transaction and issuing its
  requests; prepare data first, then open and populate the transaction synchronously.
- Headless browser success does not prove a real Tauri window, screen reader, service-worker upgrade, or reading system.
- A mutation check breaks only the intended implementation. Reverting a whole file can fail for an unrelated reason.
