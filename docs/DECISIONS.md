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

## D-004 Copy suite code with recorded lineage  (2026-11-12, status: accepted)

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

## D-007 Offline-first working copy with controlled folder synchronization  (2026-11-12, status: proposed)

**Context:** The browser needs crash recovery and installability; the desktop app needs real book folders. A multi-file
working copy can diverge from disk.

**Decision:** IndexedDB stores each book and file separately, plus versions, UI metadata, file fingerprints, and a
handoff log. The editor saves to IndexedDB first. Folder synchronization compares canonical content and the last synced
fingerprint before any disk write. An external change produces a load, keep, or conflict choice. Multi-file operations
use a recoverable intent record so interruption can be completed or rolled back.

**Alternatives:** Writing disk on every keystroke increases partial-write and watcher risk. Treating disk modification
time as identity misses replacements and coarse timestamp changes. Treating IndexedDB as authoritative violates D-002.

**Consequences:** Schema adoption waits for upgrade and recovery tests in `P1-04`. Directory support outside Tauri
remains Q-004.

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

## D-010 Source grammar remains deliberately smaller than Markdown  (2026-11-12, status: proposed)

**Context:** The `.md` extension improves portability, while the app promises predictable structure and avoids layout
syntax. The brief defines only a small Markdown core plus Fountain-derived marks.

**Decision:** The first parser recognizes only documented Prose constructs. Raw HTML, tables, reference links, and
unlisted Markdown syntax stay literal or produce diagnostics; they are never executed or silently discarded. The
grammar defines precedence, escaping, malformed-input recovery, and exact source ranges before implementation.

**Alternatives:** Full CommonMark expands the parser and creates ambiguity with Prose notes, boneyards, and scene
cards. Silently normalizing unknown syntax would rewrite author intent.

**Consequences:** Q-001 and Q-002 must settle headings and research conventions before `P1-01` accepts the grammar.

## Held tensions

### T-001 Portable writing history and clean book folders  (2026-11-12, status: held)

**Owner:** Maintainer.

**Claim A:** Targets, streak history, versions, and handoff records should travel with a book across computers.

**Claim B:** A book folder should remain ordinary manuscript files, without an opaque application database or hidden
state that another editor might damage.

**Why both hold:** Portability is part of the plain-files promise, while histories and versions are not manuscript
content and may be large.

**Cost of holding both:** The blueprint cannot promise that writing history survives moving only the folder. Q-003
blocks the storage location for these aids.

**Review trigger:** `P1-04` schema design or `P4-02` target implementation begins.

### T-002 Product independence and copied-code drift  (2026-11-12, status: held)

**Owner:** Maintainer.

**Claim A:** Prose needs independent release, storage, and product boundaries, with no runtime dependency on sibling
repositories.

**Claim B:** Editing, recovery, and file-safety fixes should not diverge across several Plainchant applications.

**Why both hold:** A recorded copy supports the first release, while multiple copies raise maintenance cost.

**Cost of holding both:** Security and data-loss fixes need manual comparison until a stable shared boundary exists.

**Review trigger:** `P6-01`, or the second relevant copied-module bug that requires parallel fixes.

## Open questions

- **Q-001** Which additional headings belong to the Prose grammar: `##` through `######`, a smaller subset, or a
  dedicated mark? This blocks the complete grammar in `P1-01`; recommendation: support `##` through `######` as
  printable section headings while reserving the first `#` for the chapter title. (asked 2026-11-12 by Codex)
- **Q-002** What are the allowed research-file and citation conventions inside a book folder, and are research files
  listed in `book.txt` or ignored by manuscript order? This blocks research claims and part of `P1-01`;
  recommendation: reserve an optional `research/` directory, ignore it during export, and use footnotes as the only
  v0.1 citation mechanism. (asked 2026-11-12 by Codex)
- **Q-003** Where should targets, streak history, versions, and handoff records live for portability: IndexedDB only,
  an optional sidecar directory, or explicit export and import? This blocks the final `P1-04` schema and `P4-02`;
  recommendation: IndexedDB for v0.1 plus an explicit portable backup after the core manuscript path works. (asked
  2026-11-12 by Codex)
- **Q-004** Does v0.1 promise linked-folder editing in supported Chromium browsers through the File System Access API,
  or only in Tauri? This blocks the browser half of `P1-06`; recommendation: Tauri owns linked folders in v0.1, while
  the browser app owns IndexedDB books and explicit folder import or export. (asked 2026-11-12 by Codex)
- **Q-005** Which desktop operating systems and browsers are release targets for `0.1.0`? This blocks packaging and
  the release matrix in `P5-02` and `P5-05`; recommendation: choose only platforms the maintainer can run or arrange
  to test. (asked 2026-11-12 by Codex)
- **Q-006** What licence and private security-reporting address should the repository publish? This blocks the final
  licence file in `P0-02` and the release-ready security policy in `P5-07`. (asked 2026-11-12 by Codex)
