# Plainchant suite lineage

This is the provenance record for the application foundation adopted by P0-03 on 2026-11-13. The sibling repositories
were inspected read-only. Copied files became Plainchant Prose source under this repository's rules.

## Foundation

Plainchant Scribe is the primary foundation. The copy comes from commit
`e2b22186a481afb6b0180d0883ce21d393ae7352` (the clean Scribe `master` observed on 2026-11-13). Its application
code is identical to released tag `v0.1.0`, commit `bf361aa`; the later commit changes repository documentation and
housekeeping. P0-03 copied the complete static application, native shell, test harness, linked manual, fonts, icons,
and the round-trip helper. It did not copy Scribe's Git history, instructions, roadmap, active design documents,
licence, generated manual inputs, or unrelated tools.

Plainchant is the secondary writing-source reference at commit
`173a2ff0660b1304be89d439efd217f24c749c4b`. No Plainchant file was copied in P0-03. Later editor, screenplay-text,
typing, focus, and narration work may inspect that commit and must record each file copied or adapted.

## Why Scribe

Scribe already supplies a tested static multi-file shell, IndexedDB persistence and versions, local-only assets,
project and native-folder mechanics, Markdown ingestion, EPUB archive code, offline installation, find and replace,
and a Tauri v2 boundary. These are closer to Prose's foundation than Plainchant's single-document screenplay model.
The adoption established a known-green program. P0-04 renamed and hardened it; P0-05 trimmed the discarded features.

The inherited architecture remains Scribe during P0-03. Its EPUB/XHTML publication model is not the Prose manuscript
model. Prose's `book.txt` and chapter Markdown authority, parser, range edits, recovery transactions, and one-way
handoff remain planned work.

## Baseline evidence

The first sandboxed run reached 309 of 313 tests. One linked file and one third-party notice had been omitted from the
initial copy; the installed `qrencode` and `zbarimg` executables were visible but blocked from execution by the
sandbox. Copying the pinned `docs/manual.html`, copying `tools/roundtrip.js`, adding Prism's MIT notice to the Prose
licence, and rerunning with external-oracle execution allowed produced `313/313 passed` on 2026-11-13.

EPUBCheck reported `not run` because no jar was configured. Ace reported `not run` because no CLI was configured.
LibreOffice, ImageMagick, qrencode, and zbarimg ran. This proves the copied Scribe baseline on this environment; it
does not prove any Prose behaviour or release support.

## Retained foundation

The intended retained seams are:

- the ordered classic-script static shell, local fonts and icons, service worker, and web manifest;
- pure UMD modules, the Node harness, fixtures, optional-oracle reporting, and Rust tests;
- multi-file project representation, path validation, archive handling, IndexedDB store, versions, library, find and
  replace, formatting helpers, and conflict-oriented file synchronization;
- Markdown and DOCX ingestion as implementation evidence, subject to Prose scope decisions;
- ZIP, XML, XHTML, EPUB packaging, checking, and round-trip utilities for the later one-way Scribe handoff;
- Tauri v2 dialogs and filesystem mechanisms after replacement with Prose's folder-confined commands.

Retaining a file here does not accept its present interface. P0-04 through P1-07 own the required adaptation and proof.

## Removal and replacement targets

P0-04 replaced every product, package, cache, storage, manifest, desktop, and Tauri identifier. It also disabled the
public global Tauri object and introduced the strict D-017 page CSP. P0-05 removed the inherited EPUB file association.

P0-05 removed Scribe's reader and device simulator, live EPUB stage, layout and style studio, covers, embedded-font
management, fixed-layout tools, publication metadata panels, reading-system store checks, accessibility-publication
forms, NCX controls, preview server, QR sharing, and Scribe-specific help. It removes the tests and native commands
that solely proved those discarded features, while adding structure guards against their return. A small EPUB fixture
remains test-only so the retained EPUB packaging seam keeps direct coverage.

Prose replaces Scribe's EPUB-as-project authority with `book.txt` plus ordered Markdown chapters. Scribe's current
project, store, versions, folder, finding, Markdown, and EPUB modules are candidates for adaptation, not accepted
domain contracts.

## Inherited traps

- `src-tauri/tauri.conf.json` currently enables `withGlobalTauri` and has no CSP. P0-04 must close both gaps before
  the native foundation is treated as secure.
- Scribe's service worker, storage names, cache names, ports, application IDs, desktop association, temporary-folder
  prefixes, and tests deliberately assert Scribe identifiers.
- `app.html` loads a large coupled script graph. Removing one feature requires tracing its HTML, application script,
  pure module, persistence, service worker, native command, and test coverage together.
- The inherited manual describes Scribe and exists only to keep the unchanged P0-03 shell internally linked. It is a
  replacement target, not Prose user documentation.
- Several tests use installed external executables. Absence must remain an explicit `not run`; sandbox refusal is an
  environment failure, not evidence that an oracle is absent.
- Prism 1.30.0 and the bundled fonts carry local licence files. Their notices must remain while those assets remain.
- The copied native shell associates `.epub` files and can run Java EPUBCheck. Neither boundary is accepted for Prose.
- Scribe's source comments and tests cite Scribe roadmap and decision identifiers. Those references are historical
  lineage until the relevant code is retained or removed.

## Copied-file manifest

Every path below was copied byte-for-byte from the pinned Scribe commit. `LICENSE` was not copied; the existing Prose
licence was extended with Prism's notice.

```text
app.html
docs/manual.html
fonts/OFL-CourierPrime.txt
fonts/OFL-EBGaramond.txt
fonts/OFL-Inter.txt
fonts/courier-prime-latin-400-italic.woff2
fonts/courier-prime-latin-400-normal.woff2
fonts/courier-prime-latin-700-italic.woff2
fonts/courier-prime-latin-700-normal.woff2
fonts/courier-prime-latin-ext-400-italic.woff2
fonts/courier-prime-latin-ext-400-normal.woff2
fonts/courier-prime-latin-ext-700-italic.woff2
fonts/courier-prime-latin-ext-700-normal.woff2
fonts/eb-garamond-latin-400-italic.woff2
fonts/eb-garamond-latin-400-normal.woff2
fonts/eb-garamond-latin-600-normal.woff2
fonts/eb-garamond-latin-ext-400-italic.woff2
fonts/eb-garamond-latin-ext-400-normal.woff2
fonts/eb-garamond-latin-ext-600-normal.woff2
fonts/inter-latin-400-normal.woff2
fonts/inter-latin-600-normal.woff2
fonts/inter-latin-ext-400-normal.woff2
fonts/inter-latin-ext-600-normal.woff2
icons/apple-touch-icon.png
icons/icon-192.png
icons/icon-512.png
icons/icon-maskable-512.png
icons/icon.svg
index.html
manifest.webmanifest
package.json
src-tauri/Cargo.lock
src-tauri/Cargo.toml
src-tauri/build.rs
src-tauri/capabilities/default.json
src-tauri/gen/schemas/acl-manifests.json
src-tauri/gen/schemas/capabilities.json
src-tauri/gen/schemas/desktop-schema.json
src-tauri/gen/schemas/linux-schema.json
src-tauri/icons/icon.png
src-tauri/linux/plainchant-scribe.desktop
src-tauri/src/epubcheck.rs
src-tauri/src/main.rs
src-tauri/src/open_files.rs
src-tauri/src/preview.rs
src-tauri/tauri.conf.json
src/app/a11y-ui.js
src/app/asset-ui.js
src/app/assets.js
src/app/blocks-ui.js
src/app/book-ui.js
src/app/contents-ui.js
src/app/core.js
src/app/cover-ui.js
src/app/dialogs.js
src/app/dock-ui.js
src/app/epub-export-ui.js
src/app/epubcheck-ui.js
src/app/explorer-move.js
src/app/explorer-ui.js
src/app/export.js
src/app/find-project.js
src/app/find.js
src/app/fixed-layout-ui.js
src/app/fonts-ui.js
src/app/format-ui.js
src/app/help.js
src/app/import.js
src/app/inspector-ui.js
src/app/layout.js
src/app/library-ui.js
src/app/main.js
src/app/matter-ui.js
src/app/menus.js
src/app/notes-ui.js
src/app/offline.js
src/app/outline-ui.js
src/app/panes.js
src/app/parts-ui.js
src/app/persistence.js
src/app/preview-ui.js
src/app/problems-ui.js
src/app/project-links.js
src/app/reader-device.js
src/app/reader-ui.js
src/app/settings.js
src/app/shade.js
src/app/spine-ui.js
src/app/stage-book.js
src/app/stage-links.js
src/app/stage-nav.js
src/app/stage.js
src/app/structure-ui.js
src/app/style-ui.js
src/app/tauri-files.js
src/app/typing.js
src/app/versions-ui.js
src/app/zip-ui.js
src/book-a11y.js
src/book-alt.js
src/book-blocks.js
src/book-chapters.js
src/book-check.js
src/book-contents.js
src/book-cover.js
src/book-export.js
src/book-fonts.js
src/book-images.js
src/book-lang.js
src/book-layout.js
src/book-matter.js
src/book-meta.js
src/book-ncx.js
src/book-notes.js
src/book-order.js
src/book-page.js
src/book-pages.js
src/book-roles.js
src/book-stage.js
src/book-style.js
src/book-template.js
src/book.js
src/code-shade.js
src/css-ast.js
src/css-lint.js
src/docx-import.js
src/docx.js
src/dom-outline.js
src/editing.js
src/epub.js
src/epubcheck-report.js
src/example-book.js
src/filesync.js
src/finding.js
src/font-info.js
src/format.js
src/hints.js
src/home.css
src/html-ast.js
src/imagelib.js
src/importing.js
src/library.js
src/links.js
src/markdown-import.js
src/nav.js
src/opf-edit.js
src/parts.js
src/preview.js
src/project.js
src/projectlink.js
src/qr.js
src/shortcuts.js
src/store.js
src/styles.css
src/suggest.js
src/vendor/prism/LICENSE
src/vendor/prism/README.md
src/vendor/prism/prism.js
src/versions.js
src/xhtml.js
src/xml-ast.js
src/zip.js
sw.js
test/ace.test.js
test/book-a11y.test.js
test/book-blocks.test.js
test/book-chapters.test.js
test/book-check-cases.js
test/book-check.test.js
test/book-contents.test.js
test/book-cover.test.js
test/book-export.test.js
test/book-fonts.test.js
test/book-images.test.js
test/book-layout.test.js
test/book-matter.test.js
test/book-meta.test.js
test/book-ncx.test.js
test/book-notes.test.js
test/book-page.test.js
test/book-stage.test.js
test/book-structure.test.js
test/book-style.test.js
test/book-template.test.js
test/book.test.js
test/codeshade.test.js
test/corpus.json
test/css-ast.test.js
test/css-lint.test.js
test/docx-oracle.test.js
test/docx.test.js
test/epub.test.js
test/epubcheck-report.test.js
test/epubcheck.test.js
test/fixtures/docx/manuscript.fodt
test/fixtures/xml/chapter.xhtml
test/fixtures/xml/container.xml
test/fixtures/xml/content.opf
test/fixtures/xml/nav.xhtml
test/font-info.test.js
test/format.test.js
test/harness.js
test/hints.test.js
test/html-ast.test.js
test/images-oracle.test.js
test/markdown-import.test.js
test/nav.test.js
test/opf-edit.test.js
test/preview.test.js
test/project.test.js
test/projectlink.test.js
test/qr.test.js
test/roundtrip.test.js
test/run.js
test/shortcuts.test.js
test/structure.test.js
test/theme.test.js
test/xhtml.test.js
test/xml-ast.test.js
tools/roundtrip.js
```
