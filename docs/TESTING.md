# Testing

This document defines the evidence required as Plainchant Prose is implemented. The repository currently has only the
Manifold documentation check. Planned commands do not exist until their roadmap items create them, and must never be
reported as run before then.

## Suites

| Suite | Planned file or command | Proves | Does not prove | Needs |
| --- | --- | --- | --- | --- |
| Documentation, current | `python3 tools/check_docs.py` | Active documents agree on IDs, links, paths, placeholders, and handoff shape | Product design is correct or code exists | Python 3 |
| Unit, planned | `npm test` through `test/run.js` | Pure parser, splice, book, sync, store-rule, statistics, compare, and export contracts | DOM, real IndexedDB, native files, or reader behaviour | Node version selected in `P0-05` |
| Structure, planned | Part of `npm test` | Script order, global names, file size, offline list, local assets, lineage rename guards | That the app runs | Node |
| Browser, planned | `npm run test:browser` | Editor, undo, IndexedDB, recovery, accessibility mechanics, service worker, and main workflows in one headless engine | Other browsers, real assistive technology, or a human-visible layout | Headless browser, disposable profile |
| Desktop shell, planned | `npm run tauri:test` | Path confinement, size limits, atomic-write rules, permission state, command registration | Native dialogs and a real packaged window | Rust and Cargo |
| EPUB oracle, planned | Part of `npm test` when configured | Generated fixtures satisfy the observed EPUBCheck version | Scribe interpretation or reading-system rendering | Java and EPUBCheck |
| Scribe compatibility, planned | Dedicated fixture runner from `P3-05` | The recorded Scribe commit imports and re-exports expected structure | Future Scribe versions or visual quality | Sibling repository at recorded commit |
| DOCX oracle, planned | Part of `npm test` when configured | LibreOffice can open or normalize generated DOCX fixtures | Microsoft Word compatibility | LibreOffice |
| Manual release matrix, planned | Procedure in this document | Named workflows worked on named real environments | Untested platforms or repeatability | Maintainer access |

The planned fast set is `npm test` plus `python3 tools/check_docs.py`. The planned full set adds
`npm run test:browser`, `npm run tauri:test`, configured oracles, and the manual checks relevant to the change.

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
- Run no planned `npm` or Tauri command until `P0-05` adds and documents it.

## Current check

```bash
python3 tools/check_docs.py
```

A pass ends with zero errors. Warnings require review and may indicate that HANDOFF needs consolidation. This check
reads active Manifold documents and `docs/archive/`; it does not inspect application code or validate design claims.

## Planned unit and structure checks

```bash
npm test
```

`P0-05` defines the runner and final summary. The initial suites must cover:

- grammar precedence, malformed recovery, escaping, half-open source ranges, CRLF, Unicode, and large input;
- byte-preserving range splices and index-order edits;
- multi-file transaction planning, interruption, rollback, and stale-before-image refusal;
- folder conflict states for identical, local-only, disk-only, simultaneous, missing, added, and renamed files;
- IndexedDB schema rules separately from its browser adapter;
- XHTML and archive output at byte and structure levels;
- inherited-name rejection, classic-script duplicate globals, local-only assets, and service-worker list agreement.

Critical generators use property or fuzz cases with bounded input. Parsers and archive readers include hostile inputs
that must return a diagnostic or refusal without throwing an unclassified exception.

## Planned browser checks

```bash
npm run test:browser
```

The runner uses a new profile and a temporary HTTP origin. It covers create, type, undo, save, reload, emergency
recovery, binder and corkboard keyboard movement, preview escaping, find and replace, versions, theme contrast, zoom,
focus order, accessible names, service-worker update, and offline reload. It injects quota failures and interrupted
writes. A green banner alone is insufficient; the runner checks a final summary and process exit code.

Browser tests run against Chromium for the v0.1 support claim. Results from another engine remain additional evidence
and do not extend the supported matrix without a later decision (D-013).

## Planned desktop checks

```bash
npm run tauri:test
```

Rust tests create a temporary selected root and cover traversal, absolute paths, symlinks leaving the root, Unicode and
case aliases where the platform exposes them, permission revocation, file-count and byte limits, stale fingerprints,
atomic replacement, watcher coalescing, and command registration. A real-window check remains manual.

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
