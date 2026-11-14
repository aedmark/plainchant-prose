# Session handoff

Read this first when resuming work. Rewrite Current state when the repository changes materially or work pauses. The
session log is append-only; permanent rules live in the linked owner documents.

Protocol: [AGENTS.md](../AGENTS.md). Plan: [ROADMAP.md](../ROADMAP.md). Architecture:
[ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [DECISIONS.md](DECISIONS.md). Tests: [TESTING.md](TESTING.md).
Security: [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md). History: [archive/](archive/README.md).

## Current state

_Last updated: 2026-11-13, session 2, on `master` tracking `origin/master`: P0-01 and P0-02 are complete, all six design
questions have answers, and application code does not exist._

**Session owner:** None after session 2 closes. Claim ownership here before editing overlapping files.

**Where things stand:** `BRIEF.md` remains the maintainer-owned source. Plainchant Prose uses `.md` chapters, standard
`##` through `######` headings, an ignored optional `research/` directory, IndexedDB-only writing history in v0.1,
Tauri-only linked folders, and Linux desktop plus Chromium browser or PWA support. `LICENSE` contains the supplied
AI-assisted MIT terms adapted for Plainchant Prose and names Andrew Edmark and Arantor as the Humans. The private
security channel is GitHub private vulnerability reporting, which the maintainer will enable on the existing
repository. Git uses `master` and the GitHub `origin`; the blueprint commit is the current HEAD after this handoff is
committed. No application behaviour exists yet.

**Verified** (2026-11-13, documentation-only workspace, Python 3.14.10)

| Suite | Result |
| --- | --- |
| `python3 tools/check_docs.py` | **0 errors, 0 warnings in 13 files** |

**What works**

- The original brief is preserved unchanged.
- The repository contains the selected licence text with the requested project and contributor names.
- The blueprint separates observed sibling-repository evidence, accepted product choices, proposed implementation
  choices, and the resolved maintainer questions.
- The roadmap puts safe multi-file storage before UI expansion and places the Scribe handoff before secondary writing
  aids.

**Not verified**

- No parser, editor, storage, folder sync, Tauri shell, service worker, EPUB, DOCX, or application test exists.
- No output has run through EPUBCheck or Plainchant Scribe.

**Gotchas for the next session**

- `BRIEF.md` contains an unavailable embedded-plan marker. The maintainer called it noise and instructed the blueprint
  to ignore it on 2026-11-12.
- Planned file paths in ARCHITECTURE and commands in TESTING do not exist yet. Do not report them as executable.
- Plainchant commit `173a2ff` was observed on 2026-11-12 as a lineage reference; `P0-03` must record the actual full
  source hash before copying.
- Sibling repositories are separate Zones and remain read-only without a new explicit request.

## Next steps

1. The maintainer enables GitHub private vulnerability reporting and confirms it before `P5-07`.
2. Complete `P0-03` as one reviewable lineage copy before adapting storage or UI.

## Open questions for maintainers

- None. Q-001 through Q-006 are answered in DECISIONS.

## Session log

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
