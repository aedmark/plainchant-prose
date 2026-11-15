# Plainchant Prose

Plainchant Prose is a planned long-form writing application for novelists and non-fiction authors. A book remains a
folder that a person can read without the application: `book.txt` records metadata and reading order, while each
chapter is a Markdown (`.md`) file. The application supplies structure, preview, recovery, versions, and a one-way
EPUB 3.3 handoff to Plainchant Scribe.

This repository contains the product blueprint and a trimmed Plainchant Scribe-derived application foundation. The
shell is a measured starting point, not a working Plainchant Prose implementation.

## Product boundary

Prose owns drafting. The sibling application Plainchant Scribe owns layout and publication after handoff.
Prose does not provide page design, covers, print output, accounts, collaboration, cloud sync, or generated writing.

The first release is designed around five constraints:

1. The writer's `book.txt` and `.md` chapter files are authoritative.
2. The app changes only text the writer edits or explicitly moves.
3. The frontend is static HTML, CSS, and vanilla JavaScript, with no build step or runtime package dependency.
4. The app works offline; IndexedDB supplies recovery and a working copy, and Tauri v2 supplies desktop folder access.
5. Sending to Scribe creates a valid EPUB 3.3. It does not create a live two-way link.

## Start here

- [BRIEF.md](BRIEF.md) is the maintainer's original product brief.
- [ROADMAP.md](ROADMAP.md) breaks the work into independently verifiable phases and release gates.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) defines the planned components, data flow, and invariants.
- [docs/SOURCE_FORMAT.md](docs/SOURCE_FORMAT.md) defines the normative `book.txt` and chapter grammar.
- [docs/DECISIONS.md](docs/DECISIONS.md) records accepted choices, proposals, and questions requiring maintainer input.
- [docs/TESTING.md](docs/TESTING.md) defines the proof expected at each boundary.
- [docs/HANDOFF.md](docs/HANDOFF.md) records the repository's current state.

## Current status

The Scribe foundation is recorded under `P0-03`; `P0-04` renames it to Prose and hardens its Tauri page boundary;
`P0-05` removes Scribe-only publication, reader, layout, cover, font, checking, preview-server, and file-association
surfaces. The retained shell preserves the multi-file, persistence, versions, library, find, offline, native-folder,
Markdown, and EPUB-package seams for later adaptation. `P0-06` adapts the retained harness and adds maintained browser
and Rust commands. Phase 0 is complete; `P1-01` specifies the Prose source grammar and fixtures, `P1-02` implements
the pure ranged parser and safe renderer, and `P1-03` is the next implementation item. See
[the lineage record](docs/archive/plainchant-lineage.md) and [the roadmap](ROADMAP.md).

## Documentation check

The blueprint uses the Manifold repository-memory scheme. Check its internal links, identifiers, placeholders, and
handoff state with:

```bash
python3 tools/check_docs.py
```

This check proves that the documents agree with one another. It does not prove that planned application behaviour
exists.

## Licence

Plainchant Prose uses the [AI-assisted MIT licence](LICENSE), with Andrew Edmark and Arantor identified as the human
contributors.
