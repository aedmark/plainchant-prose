# Session handoff

Read this first when resuming work. Rewrite Current state when the repository changes materially or work pauses. The
session log is append-only; permanent rules live in the linked owner documents.

Protocol: [AGENTS.md](../AGENTS.md). Plan: [ROADMAP.md](../ROADMAP.md). Architecture:
[ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [DECISIONS.md](DECISIONS.md). Tests: [TESTING.md](TESTING.md).
Security: [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md). History: [archive/](archive/README.md).

## Current state

_Last updated: 2026-11-12, session 1, with no Git branch or commit: the Manifold template has been adopted as a
Plainchant Prose blueprint; application code, Git history, a licence, and release configuration do not exist._

**Session owner:** None after session 1 closes. Claim ownership here before editing overlapping files.

**Where things stand:** `BRIEF.md` remains the maintainer-owned source. The active documents now define the product
boundary, planned architecture, accepted and proposed decisions, open questions, security model, verification method,
and phased roadmap. The confirmed choices are the Plainchant Prose name, `.md` chapters, one file per chapter, recorded
code copying, later shared-API investigation, and explicit requests before agent commits or pushes. No application
behaviour exists yet.

**Verified** (2026-11-12, documentation-only workspace, Python 3.14.10)

| Suite | Result |
| --- | --- |
| `python3 tools/check_docs.py` | **0 errors, 0 warnings in 13 files** |

**What works**

- The original brief is preserved unchanged.
- The blueprint separates observed sibling-repository evidence, accepted product choices, proposed implementation
  choices, and unanswered maintainer questions.
- The roadmap puts safe multi-file storage before UI expansion and places the Scribe handoff before secondary writing
  aids.

**Not verified**

- No parser, editor, storage, folder sync, Tauri shell, service worker, EPUB, DOCX, or application test exists.
- No Git repository or remote exists; the `.git` directory is empty in this workspace.
- No output has run through EPUBCheck or Plainchant Scribe.

**Gotchas for the next session**

- `BRIEF.md` contains an unavailable embedded-plan marker. The maintainer called it noise and instructed the blueprint
  to ignore it on 2026-11-12.
- Planned file paths in ARCHITECTURE and commands in TESTING do not exist yet. Do not report them as executable.
- Plainchant commit `173a2ff` was observed on 2026-11-12 as a lineage reference; `P0-03` must record the actual full
  source hash before copying.
- Sibling repositories are separate Zones and remain read-only without a new explicit request.

## Next steps

1. The maintainer answers the release-blocking questions that affect the next chosen item, especially Q-006 before
   repository licensing and Q-001 before final grammar fixtures.
2. On explicit request, complete `P0-02`: initialize Git, choose a default branch and remote, add the selected licence,
   run the documentation check, and record the commit.
3. Complete `P0-03` as one reviewable lineage copy before adapting storage or UI.

## Open questions for maintainers

- Q-001 defines printable subheadings and blocks the complete grammar.
- Q-002 defines research and citation file conventions.
- Q-003 defines portability for targets, histories, versions, and handoff records.
- Q-004 defines linked-folder support in the browser build.
- Q-005 defines release operating systems and browsers.
- Q-006 defines the repository licence and private security contact.

## Session log

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
