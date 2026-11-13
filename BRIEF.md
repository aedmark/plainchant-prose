# Plainchant prose writer: design brief

Nov 10, 2026 · @Andrew

## Summary

The fourth Plainchant app is a long-form prose writer for novelists and non-fiction authors. Its working name here is **Plainchant Draft** (the name is an open question). You type plain text in a small, Fountain-like format, the app handles structure and formatting, and the chapter files on disk stay the real copy.

It sits upstream of Plainchant Scribe: Draft is where a book gets written, and Scribe is where it gets laid out and published. One handoff connects them, and after it Scribe owns the book's files.

## Problem and place in the suite

Scribe is built for authors and small presses, but it has no place to write. It takes in a finished book as `.xhtml`, `.docx`, or `.epub`, so its users draft somewhere else, usually Word or Scrivener, and then import. Markdown import exists (D-039) but is one-way. D-002 records the maintainer's ruling (2026-11-03) that a Markdown-first writing app is "a different product". Draft is that product.

- **Screenplays:** Plainchant (Fountain) for writing, then PDF or `.fdx` out.
- **Prose books:** Draft for writing (new), then Scribe for layout and EPUB.
- **Web:** Plainchant Web for writing and layout in one app.

## Users and jobs

The main user is a solo author writing one long book (60,000 to 120,000 words) over months, who plans to publish it through Scribe or hand it to a small press.

| User | Job to be done | What fails them today |
| --- | --- | --- |
| Novelist | Draft scene by scene, move scenes around, keep the whole book in view | Word has no structure; Scrivener locks the text inside its project format |
| Non-fiction author | Write chapters with headings, notes, and citations, and keep research next to the draft | Notes leak into the manuscript, or live in a different app |
| Small press editor | Get a clean manuscript with consistent structure, ready for layout | Authors send `.docx` files with hand formatting that has to be cleaned up |
| Plainchant screenwriter | Write a novel or a treatment using the same habits and keys | Has to learn a second tool with a different philosophy |

## Principles inherited from the suite

1. **Plain text is the source of truth.** A book is a folder of `.txt` or `.md` files a person can read without the app. The app stores no second model that it writes back.
2. **No build step, no runtime dependencies.** Static HTML, CSS, and vanilla JavaScript, UMD modules in `src/*.js`, classic scripts in `src/app/*.js`, as in Plainchant and Scribe (Scribe's D-001).
3. **Offline first.** IndexedDB working copy, service worker cache, installable. Nothing is loaded from the network.
4. **Desktop through Tauri v2.** Real folders on disk, native dialogs, the same shell as the other apps.
5. **Its own Zone.** A new repository (`aedmark/plainchant-draft` or the chosen name) with its own `AGENTS.md`, docs scheme, and decisions. Rules from Scribe or Plainchant reach it only when copied in.
6. **The app formats; the writer writes.** Typing helpers, not toolbars. No bold or font buttons in the main writing view.

## The source format

A book is a folder: one `book.txt` index plus one file per chapter. The format is a small Markdown core with three marks borrowed from Fountain, so a Plainchant user already knows them.

| Mark | Meaning | Prints? |
| --- | --- | --- |
| `Key: value` lines at the top of `book.txt` | Title, author, language, series (like Fountain's title page) | Feeds metadata |
| Ordered file list in `book.txt`, `Part:` lines between | Reading order and parts | Yes |
| `# Title` on a chapter file's first line | Chapter heading | Yes |
| `* * *` alone on a line | Scene break | Yes, as a section break |
| `= One-line synopsis` under a scene break | Scene card for the outline and corkboard (Fountain synopsis) | No |
| `[[note]]` | Author's note (Fountain note) | No |
| `/* ... */` | Boneyard: cut text kept in place (Fountain) | No |
| `*italic*`, `**bold**`, `> quote` | Emphasis and block quotes, Markdown core only | Yes |
| `[^label] with a [^label]: definition` | Footnote, the same form Scribe's import reads (D-039) | Yes, as an endnote |

```text
Title: The Salt Road
Author: A. Writer
Language: en

Part: One
01-harbour.txt
02-the-letter.txt
Part: Two
03-crossing.txt
```

The app never rewrites these files to a house style. Like Scribe's splices (D-002), an edit changes only the text the writer touched.

## Features for v0.1

Most of v0.1 comes from Plainchant's existing modules, adapted from screenplay elements to chapters and scenes. The new work is the format parser, the book index, and the Scribe handoff.

| Feature | Comes from (Plainchant module) | New work |
| --- | --- | --- |
| Plain-text editor with colour hints for marks | `editing.js`, `typing.js` | Prose marks instead of Fountain elements |
| Live manuscript preview (reading view) | `fountain.js` render path | A prose renderer for the format above |
| Binder: parts, chapters, scenes in a side tree | `outline.js`, `outline-ui.js` | Driven by `book.txt` and scene breaks |
| Corkboard of scene cards from `=` synopses | `outline.js` | Card view; drag to reorder rewrites only `book.txt` or moves scene text |
| Word count, targets per chapter and book, daily streak | `stats.js`, `stats-ui.js` | Targets and streak history |
| Versions and scene-by-scene compare | `versions.js`, `compare.js` | Compare at the scene level of a chapter |
| Autosave, emergency buffer, 30-day restore | `store.js`, `library.js`, `safekeeping.js` | Multi-file books instead of single scripts |
| Focus mode, find and replace across the book | `focus.js`, `finding.js` | Search across all chapter files |
| Read-aloud time per chapter | `narration.js` | Prose reading rate instead of screen time |
| Link a book to a real folder | `filesync.js`, Tauri shell | Watch a folder of files, not one file |
| Export: `.epub` for Scribe, `.md`, `.docx` | `export.js` | The Scribe handoff below; `.docx` for agents and editors |

Print, a cover, and layout are not in Draft. They belong to Scribe.

## Handoff to Scribe

Draft hands off a valid EPUB 3.3 file, and Scribe opens it with the `.epub` import it already has. Scribe needs no changes, and EPUBCheck checks the handoff.

1. **Send to Scribe** writes a `.epub` with `content.opf` (metadata from `book.txt`), `nav.xhtml` (parts and chapters), and one `.xhtml` per chapter in spine order.
2. Scene breaks become `<hr/>`, which is how Scribe's Markdown import already writes them. Notes, the boneyard, and synopses are left out.
3. Footnotes become endnotes in the shape Scribe's notes take (D-034), so Scribe can restyle them.
4. Draft's tests run the export through EPUBCheck as the oracle, as Scribe's do (D-005).
5. **After the handoff, Scribe's files are the truth.** Draft records which version was sent. It does not try to merge edits made in Scribe back into the draft.

The late-revision problem is real: an author fixes a typo in Draft after layout has started in Scribe. v0.1 leaves this to the author (send again and redo the layout, or fix it in Scribe). A chapter-level replace in Scribe is a possible later fix, and it is listed under open questions.

## Out of scope

- **Layout, styling, fonts, covers, print PDF.** Scribe owns these. Print interiors are a Scribe feature, decided there.
- **Rich text editing.** No WYSIWYG mode, no font or colour buttons.
- **Sync, accounts, collaboration.** Local files and IndexedDB only, the same as the other apps.
- **AI writing features.** No generated text or rewriting.
- **A research database.** Notes live as plain files in the book folder, not in a separate store.
- **Full Markdown.** No tables, raw HTML, or reference links. They would leak layout into the draft.

## Risks and open questions

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Code copied from Plainchant drifts apart from Plainchant | Two copies of `store.js`, `versions.js`, and others to fix | Copy once and record the lineage, as Scribe did; consider a shared module only once a third copy appears |
| A multi-file book in IndexedDB | Plainchant's store is built around one script per record | Design the book store first (Phase 1) |
| Scrivener and Obsidian already serve this audience | Little reason to switch | Lead with the Scribe pipeline and plain files; do not chase Scrivener's feature list |
| Late revisions after the handoff | Authors lose fixes or redo layout | See the late-revisions question below |

- [ ] **Name.** "Plainchant Draft" is a working name. Alternatives: Plainchant Folio, Plainchant Quire.
- [ ] **One file per chapter, or one file per scene?** Per chapter is simpler and matches Scribe; per scene makes reordering scenes a file move.
- [ ] **Late revisions:** should Scribe gain a chapter-level replace from a newer Draft export, or does the handoff stay one-way?
- [ ] **Shared code:** copy Plainchant's modules into the new repo, or extract a shared library repo for all three apps?

## Plan to first release

&#91;embedded content: plan to 0.1.0 · 5 phases, 4 gates\]

The handoff in Phase 3 is the reason the app exists, so it comes before the writing aids. Each gate is a test in the new repository, not a judgement call.
