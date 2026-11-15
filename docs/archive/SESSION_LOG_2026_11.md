# Session log, November 2026

These completed sessions moved from `docs/HANDOFF.md` when the live log exceeded ten entries. They are historical
evidence; current state and next work remain in the live handoff.

## Session 1: 2026-11-12: adopt the Plainchant Prose blueprint

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

## Session 2: 2026-11-13: settle blueprint choices and add the licence

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

## Session 3: 2026-11-13: adopt the Scribe foundation

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
