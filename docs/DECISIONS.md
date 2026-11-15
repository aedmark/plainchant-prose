# Decisions

This append-only record keeps choices that a future session might otherwise re-litigate. Accepted decisions govern
implementation. Proposed decisions describe the blueprint's current recommendation and require maintainer acceptance
before code relies on them. A reversal adds a later decision and marks the earlier one superseded.

## D-001 Static vanilla JavaScript frontend  (2026-11-12, status: accepted)

**Context:** The maintainer's brief inherits the suite's static, inspectable architecture. Plainchant and Scribe both
separate pure logic from browser integration and run without a frontend build.

**Decision:** Pure logic lives in UMD modules under `src/*.js`; ordered classic scripts under `src/app/*.js` connect
the DOM, IndexedDB, service worker, and native bridge. The frontend has no framework, build step, or runtime package
dependency. Tauri v2 and test oracles sit outside this frontend rule.

**Alternatives:** A framework and bundler add a build and package supply chain. ES modules prevent the suite's current
`file://` development path and change its classic-script structure.

**Consequences:** Application globals and script order need structure tests. Complex parsing, archive, and export code
is maintained locally or copied with lineage.

**Review trigger:** A required capability cannot be implemented or safely maintained with platform APIs and the
approved copied modules.

## D-002 Book files are authoritative  (2026-11-12, status: accepted)

**Context:** The product exists to avoid an opaque project format. The maintainer selected `.md` for chapter files.

**Decision:** A book folder contains one `book.txt` index and ordered `.md` chapter files. Those files are the
authoritative manuscript. IndexedDB is a recoverable working copy and history store; parsed models are derived. The app
never serializes a derived model over an untouched file. Edits and structural operations use source-range splices.

**Alternatives:** A JSON project model would create a second truth and could reformat hand edits. One combined Markdown
file makes independent chapter sync, navigation, and recovery more costly.

**Consequences:** Every parsed node that can be edited needs a reliable source range. Unknown metadata and unrecognized
Markdown remain in the source. Folder conflicts are a first-class workflow.

## D-003 One Markdown file per chapter  (2026-11-12, status: accepted)

**Context:** The brief left chapter files versus scene files open. The maintainer chose chapter files.

**Decision:** Each ordered manuscript entry in `book.txt` names a `.md` chapter. Scene breaks and optional synopses
divide scenes inside that file. Chapter moves splice the index; scene moves splice chapter text, including across two
chapter files when requested.

**Alternatives:** One file per scene simplifies card movement but makes the folder noisy, weakens the Scribe chapter
mapping, and requires another grouping layer.

**Consequences:** Cross-chapter scene movement needs an atomic, recoverable multi-file transaction. Large-chapter
performance and newline preservation need fixtures.

**Review trigger:** Real books demonstrate that scene-range movement is unreliable or cannot meet measured performance
budgets; see `P6-03`.

## D-004 Copy suite code with recorded lineage  (2026-11-12, status: superseded by D-016)

**Context:** Plainchant already contains relevant editing, storage, outline, statistics, versions, compare, file-sync,
narration, focus, finding, and Tauri patterns. The maintainer chose a recorded copy and wants a shared API considered
later.

**Decision:** `P0-03` copies only selected files from one recorded Plainchant commit. A lineage digest lists every file,
source commit, relevant source decisions, adaptations, and removed behaviour. Fixes do not flow automatically in
either direction. `P6-01` considers a shared suite API after Prose exposes stable common boundaries.

**Alternatives:** A Git fork carries unrelated screenplay history. A shared library now would design an API before
Prose's multi-file requirements are known. Copying without a digest loses the explanation behind inherited guards.

**Consequences:** Copied security and data-loss fixes must be compared manually across repositories. The initial
observed source reference is Plainchant commit `173a2ff` on 2026-11-12; the copy item records the actual full hash.

## D-005 One-way EPUB 3.3 handoff to Scribe  (2026-11-12, status: accepted)

**Context:** Prose owns drafting and Scribe owns layout and publication. Scribe already imports EPUB files.

**Decision:** Send to Scribe creates an EPUB 3.3 with package metadata from `book.txt`, a navigation document,
ordered XHTML chapters, scene breaks as `<hr/>`, and Scribe-compatible notes. Synopses, author notes, and boneyards are
excluded. Prose records the sent source revision. Scribe owns its imported files after handoff.

**Alternatives:** Directly writing a Scribe project couples two repositories and storage schemas. Round-trip merge
needs stable chapter identity and layout-preserving replacement rules that do not exist.

**Consequences:** A correction after handoff is made in Scribe or requires a new handoff and repeated layout work.
The UI must explain that ownership changes at handoff.

**Review trigger:** Repeated late-revision loss justifies the separately designed `P6-02` workflow.

## D-006 EPUBCheck and Scribe are separate handoff oracles  (2026-11-12, status: accepted)

**Context:** EPUB validity does not prove that Scribe interprets the manuscript as intended. Scribe compatibility does
not prove EPUB conformance.

**Decision:** Export fixtures run through EPUBCheck when available and through a pinned Scribe version or commit.
Reports identify both versions. A missing oracle prints "not run" with its reason. Deliberately malformed controls
prove that each oracle can reject relevant failures.

**Alternatives:** A locally authored validator grades its own output. Scribe-only tests miss package conformance; an
EPUBCheck-only test misses application-level interpretation.

**Consequences:** CI can pass deterministic tests while reporting an unavailable oracle separately. Release evidence
must name every oracle that actually ran.

## D-007 Offline-first working copy with controlled folder synchronization  (2026-11-12, status: accepted 2026-11-13)

**Context:** The browser needs crash recovery and installability; the desktop app needs real book folders. A multi-file
working copy can diverge from disk.

**Decision:** IndexedDB stores each book and file separately, plus versions, UI metadata, file fingerprints, and a
handoff log. The editor saves to IndexedDB first. Folder synchronization compares canonical content and the last synced
fingerprint before any disk write. An external change produces a load, keep, or conflict choice. Multi-file operations
use a recoverable intent record so interruption can be completed or rolled back.

**Alternatives:** Writing disk on every keystroke increases partial-write and watcher risk. Treating disk modification
time as identity misses replacements and coarse timestamp changes. Treating IndexedDB as authoritative violates D-002.

**Consequences:** Schema adoption waits for upgrade and recovery tests in `P1-04`. Targets, streaks, versions, and
handoff records remain in IndexedDB for v0.1. A portable backup is later work, and moving only the book folder does not
move this history.

## D-008 Native access is dialog-scoped and folder-confined  (2026-11-12, status: proposed)

**Context:** A Tauri webview with general filesystem or shell access would turn rendered manuscript content into a
native security boundary.

**Decision:** Rust commands accept paths only after a native folder choice and only while their canonical form remains
inside that selected folder. The shell enforces file-count and size limits, uses atomic replacement for writes where
the platform permits, exposes no shell command, disables the global Tauri object, and applies a strict content-security
policy.

**Alternatives:** Tauri's broad filesystem plugin exposes more capability than the writing workflow needs. Browser-only
directory access does not cover all intended desktop platforms.

**Consequences:** Folder identity and permission revocation need platform-specific tests. Symlinks and path aliases are
resolved before authorization.

## D-009 Manifold documentation is repository memory  (2026-11-12, status: accepted)

**Context:** The maintainer asked for full adoption of the Manifold template.

**Decision:** This repository uses `AGENTS.md`, `ROADMAP.md`, and the documents under `docs/` as their named sources of
truth. `tools/check_docs.py` stays identical to the Manifold source until a dedicated change says otherwise.

**Alternatives:** A single design document makes current state, durable decisions, verification, and history age at the
same rate. Chat-only decisions disappear between sessions.

**Consequences:** Changes update the owning document in the same work. A clean checker run proves internal document
consistency only.

## D-010 Source grammar remains deliberately smaller than Markdown  (2026-11-12, status: accepted 2026-11-13)

**Context:** The `.md` extension improves portability, while the app promises predictable structure and avoids layout
syntax. The brief defines only a small Markdown core plus Fountain-derived marks.

**Decision:** The first parser recognizes only documented Prose constructs. The first `#` heading is the chapter
title; `##` through `######` are printable section headings with their standard Markdown levels. Raw HTML, tables,
reference links, and unlisted Markdown syntax stay literal or produce diagnostics; they are never executed or silently
discarded. The grammar defines precedence, escaping, malformed-input recovery, and exact source ranges before
implementation.

**Alternatives:** Full CommonMark expands the parser and creates ambiguity with Prose notes, boneyards, and scene
cards. Silently normalizing unknown syntax would rewrite author intent.

**Consequences:** Heading depth remains portable to ordinary Markdown editors. The narrower inline and block grammar
still needs explicit fixtures before implementation.

## D-011 Research stays in an optional ignored directory  (2026-11-13, status: accepted)

**Context:** Q-002 asked how supporting research belongs beside a book without leaking into manuscript order or
handoff output. The maintainer selected an optional directory of ordinary files.

**Decision:** A book folder may contain `research/` with any ordinary supporting files. `book.txt` does not list the
directory. Prose ignores its contents during binder construction, manuscript search, word counts, preview, and export.
Footnotes are the only v0.1 citation mechanism interpreted by Prose.

**Alternatives:** Listing research in `book.txt` mixes source material with reading order. Leaving the convention
undefined weakens book-folder portability.

**Consequences:** Prose never promises to open, index, synchronize independently, or validate research files. Folder
backup tools still carry the directory because it is inside the writer's book folder.

**Review trigger:** Authors need searchable research, citation-library integration, or selective handoff attachments.

## D-012 Linked folders belong to Tauri in v0.1  (2026-11-13, status: accepted)

**Context:** Q-004 asked whether the browser build should use Chromium's File System Access API. Supporting two folder
adapters would double the conflict and permission surface before the workflow is proven.

**Decision:** Tauri owns linked-folder editing in v0.1. The Chromium browser and PWA use IndexedDB books plus explicit
book-folder import and export. Browser directory handles are outside the supported release contract.

**Alternatives:** Direct Chromium folder access offers convenience but adds a browser-specific permission and watcher
model. Calling it experimental would still create user data that needs support.

**Consequences:** Browser import and export need a safe, explicit folder package or multi-file workflow. The browser UI
does not show a linked-folder control.

**Review trigger:** The Tauri workflow is stable and browser users demonstrate demand for persistent directory access.

## D-013 Linux desktop and Chromium PWA are the v0.1 platforms  (2026-11-13, status: accepted)

**Context:** Q-005 asked which release environments the maintainer can test.

**Decision:** v0.1 supports the Tauri desktop application on Linux and the browser or installable PWA in Chromium.
Windows, macOS, Firefox, Safari, mobile browsers, and other Chromium-derived browsers receive no v0.1 support claim
without separately recorded evidence.

**Alternatives:** A three-desktop release would claim platforms unavailable for maintainer verification. A browser-only
release would omit the authoritative linked-folder workflow.

**Consequences:** Automated checks may run elsewhere, but release evidence must include real Linux desktop and Chromium
results. Documentation names untested environments directly.

**Review trigger:** Repeatable test access becomes available for another platform or browser.

## D-014 AI-assisted MIT licence  (2026-11-13, status: accepted)

**Context:** The maintainer supplied the BeSpoke repository's AI-assisted MIT licence as the source and requested the
Plainchant Prose title with only Andrew Edmark and Arantor as the human contributors.

**Decision:** `LICENSE` adapts that text to Plainchant Prose, retains the permissive MIT grant and human-computer
contribution acknowledgment, and names Andrew Edmark and Arantor as the Humans.

**Alternatives:** The standard short MIT text omits the requested AI-assistance acknowledgment. GPLv3 would impose a
copyleft condition the maintainer did not select.

**Consequences:** Copies or substantial portions include the copyright notice, acknowledgment, and permission notice.
Security reporting is governed separately by D-015.

## D-015 GitHub private vulnerability reporting  (2026-11-13, status: accepted)

**Context:** Q-006 still needed a private security-reporting path. The maintainer will enable GitHub's private
vulnerability reporting for the repository.

**Decision:** SECURITY directs reporters to the repository's private vulnerability-reporting form in GitHub's
Security area. Reports remain private while the maintainer investigates and coordinates disclosure. Enabling and
maintaining the repository setting belongs to the maintainer.

**Alternatives:** A published email address adds a separate inbox and spam surface. Public issues expose details before
assessment.

**Consequences:** The reporting form is unavailable until the maintainer enables the setting on the existing GitHub
repository. Before then, reporters use an established private channel with the maintainer.

## D-016 Scribe is the foundation; Plainchant supplies writing modules later  (2026-11-13, status: accepted)

**Context:** P0-03 initially named Plainchant as the copy source. Its editor is a working single-document screenplay
application, but its shell, persistence, and tests assume one Fountain string. The maintainer directed the foundational
scan to Plainchant Scribe. Scribe already has a multi-file IndexedDB project, cross-file versions and undo, Markdown
and EPUB modules, Tauri folder commands, an offline shell, and a 313-test Node harness.

**Decision:** P0-03 copies the released Scribe application, tests, fonts, icons, and Tauri shell from commit
`e2b22186a481afb6b0180d0883ce21d393ae7352`, without its Git history or project documentation. The full known-green
copy is the measurable baseline; Phase 0 then renames, hardens, and removes Scribe-only layout features. Plainchant
commit `173a2ff0660b1304be89d439efd217f24c749c4b` remains the recorded secondary source for prose-editor, outline,
statistics, compare, narration, focus, and writing-specific interaction work when those roadmap items begin.

**Alternatives:** Copying Plainchant first would require replacing its single-string store before the app matches the
book-folder boundary. Selecting isolated Scribe modules would lose the working dependency closure and make removals
impossible to measure against a green baseline.

**Consequences:** The first copy contains substantial EPUB-layout UI that Prose will remove. It also inherited Scribe's
global Tauri object and absent page CSP; P0-04 corrected those page-boundary gaps under D-017. Prism and bundled fonts
bring their licence notices. Copied Scribe tests describe the baseline only; a passing result does not prove Prose
behaviour.

**Review trigger:** Phase 0 evidence shows a smaller foundation can retain the multi-file, recovery, export, and native
boundaries with materially less removal risk.

## D-017 Strict CSP permits only the generated Stage bridge  (2026-11-13, status: accepted)

**Context:** P0-04 disables Tauri's public global namespace and adds a strict page CSP. The inherited Stage uses
sandboxed blob and `srcdoc` frames, author CSS, local blob images, and one application-generated interaction script.
A policy copied unchanged from Plainchant blocked those generated elements and silently disabled Stage editing.

**Decision:** The Tauri page allows only same-origin application scripts plus the fixed
`plainchant-prose-stage` nonce. `Project.assemblePreview` strips every imported script and event handler before
inserting the one nonce-bearing bridge script. A test supplies hostile imported markup with the known nonce and proves
that it is removed. The policy allows inline CSS inside the sandboxed Stage because rendering
the writer's styles is the feature, while all network-bearing directives stay confined to self, data images, or local
blob URLs. Frames are limited to self and blob. Objects, forms, foreign ancestors, and unmarked inline scripts are
refused.

The browser calls only `window.__TAURI_INTERNALS__`; `withGlobalTauri` remains false.

**Alternatives:** Allowing `unsafe-inline` for scripts would authorize imported inline code if a sanitizer regressed.
Removing the Stage bridge in P0-04 would mix feature removal into the rename and lose the measurable P0-03 baseline.
Externalizing the generated bridge would require redesigning its per-render state immediately before P0-05 reviews
whether the inherited Stage remains at all.

**Consequences:** The nonce is an authorization marker, not a secret. Safety depends on inserting it only after the
retained Stage pipeline removes imported scripts, which the Node suite enforces. Headless Chrome must exercise a
generated Stage under the exact policy after CSP, preview, or bridge changes. P0-05 removed the EPUB Stage, network
preview, and native event bridge. The generic local Stage still needs inline author CSS, blob images, and its generated
interaction bridge, so the page policy remains unchanged after review.

**Review trigger:** Prose removes or replaces the retained generic Stage, adds another executable frame, or Tauri
changes its internal bridge.

## D-018 Source conflicts remain explicit until the writer resolves them  (2026-11-14, status: accepted)

**Context:** `P1-01` needed deterministic metadata and malformed-source behaviour without letting a parser choose a
writer's intent. Duplicate metadata, unknown keys, and private unclosed marks can each produce a plausible model while
hiding a different source interpretation.

**Decision:** [The source-format contract](SOURCE_FORMAT.md) defines the complete v0.1 grammar. `Title`, `Author`, and
`Language` are required metadata; `Publish Date`, `Publisher`, and `Series` are optional. A generalized
`Custom: Name = value` form preserves accepted project-specific metadata without assigning an EPUB meaning.
Duplicates have no automatic winner. Unknown keys, duplicates, path conflicts, title conflicts, and broken footnotes
remain visible until the writer explicitly resolves them. Unclosed notes and boneyards remain literal and block export
to protect private material. Every export reruns the complete conflict check.

**Alternatives:** First- or last-occurrence precedence silently selects source that may be stale. Discarding unknown
metadata weakens the plain-files promise. Treating private unclosed marks as printable risks disclosure. Blocking all
unsupported Markdown would make ordinary hand-edited files unnecessarily fragile.

**Consequences:** Editing can continue with warnings and conflicts, while preview uses only unambiguous data. Source
resolutions are explicit, undoable range edits. `P1-02` returns half-open UTF-16 ranges so JavaScript slicing, editor
selection, and later splices share one coordinate system. Safely literal unsupported Markdown does not block export.

**Review trigger:** Real books require repeatable duplicate precedence, custom metadata needs an accepted handoff
mapping, or UTF-16 ranges cannot support a target editor without lossy conversion.

## Held tensions

### T-001 Portable writing history and clean book folders  (2026-11-12, status: resolved by D-007)

**Owner:** Maintainer.

**Claim A:** Targets, streak history, versions, and handoff records should travel with a book across computers.

**Claim B:** A book folder should remain ordinary manuscript files, without an opaque application database or hidden
state that another editor might damage.

**Why both hold:** Portability is part of the plain-files promise, while histories and versions are not manuscript
content and may be large.

**Cost of holding both:** The blueprint cannot promise that writing history survives moving only the folder.

**Resolution:** v0.1 keeps this history in IndexedDB and documents the portability limit. A later explicit backup may
carry it without placing an opaque sidecar inside every book folder.

### T-002 Product independence and copied-code drift  (2026-11-12, status: held)

**Owner:** Maintainer.

**Claim A:** Prose needs independent release, storage, and product boundaries, with no runtime dependency on sibling
repositories.

**Claim B:** Editing, recovery, and file-safety fixes should not diverge across several Plainchant applications.

**Why both hold:** A recorded copy supports the first release, while multiple copies raise maintenance cost.

**Cost of holding both:** Security and data-loss fixes need manual comparison until a stable shared boundary exists.

**Review trigger:** `P6-01`, or the second relevant copied-module bug that requires parallel fixes.

## Open questions

- **Q-001** ~~Which additional headings belong to the Prose grammar?~~ Answered 2026-11-13: `##` through `######`,
  with the first `#` reserved for the chapter title (D-010).
- **Q-002** ~~How do research files and citations live in a book folder?~~ Answered 2026-11-13: optional `research/`,
  ignored by manuscript features and export; footnotes are the interpreted v0.1 citation form (D-011).
- **Q-003** ~~Where do targets, streaks, versions, and handoff records live in v0.1?~~ Answered 2026-11-13: IndexedDB;
  portable backup is later work (D-007).
- **Q-004** ~~Does v0.1 support linked folders in Chromium?~~ Answered 2026-11-13: no; Tauri owns linked folders, and
  the browser uses IndexedDB with explicit import and export (D-012).
- **Q-005** ~~Which platforms does v0.1 support?~~ Answered 2026-11-13: Linux desktop and Chromium browser or PWA
  (D-013).
- **Q-006** ~~What licence and private security-reporting path should the repository publish?~~ Answered 2026-11-13:
  the supplied AI-assisted MIT terms (D-014) and GitHub private vulnerability reporting, enabled by the maintainer
  (D-015).
