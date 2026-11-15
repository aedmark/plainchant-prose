const harness = require('./harness.js');

globalThis.test = harness.test;
globalThis.assert = harness.assert;
globalThis.HtmlAst = require('../src/html-ast.js');
globalThis.CssAst = require('../src/css-ast.js');
globalThis.XmlAst = require('../src/xml-ast.js');
globalThis.BookTemplate = require('../src/book-template.js');
globalThis.Book = require('../src/book.js');
globalThis.OpfEdit = require('../src/opf-edit.js');
globalThis.Nav = require('../src/nav.js');
globalThis.EpubFixture = require('./epub-fixture.js');
globalThis.Xhtml = require('../src/xhtml.js');
globalThis.BookChapters = require('../src/book-chapters.js');
globalThis.BookNotes = require('../src/book-notes.js');
globalThis.BookBlocks = require('../src/book-blocks.js');
globalThis.BookExport = require('../src/book-export.js');
globalThis.Epub = require('../src/epub.js');
globalThis.MarkdownImport = require('../src/markdown-import.js');
globalThis.CodeShade = require('../src/code-shade.js');
globalThis.DomOutline = require('../src/dom-outline.js');
globalThis.Project = require('../src/project.js');
globalThis.Parts = require('../src/parts.js');
globalThis.Links = require('../src/links.js');
globalThis.Editing = require('../src/editing.js');
globalThis.Suggest = require('../src/suggest.js');
globalThis.Library = require('../src/library.js');
globalThis.StoreSchema = require('../src/store-schema.js');
globalThis.BookRecovery = require('../src/book-recovery.js');
globalThis.Store = require('../src/store.js');
globalThis.Versions = require('../src/versions.js');
globalThis.FileSync = require('../src/filesync.js');
globalThis.Importing = require('../src/importing.js');
globalThis.Finding = require('../src/finding.js');
globalThis.Zip = require('../src/zip.js');
globalThis.BookArchive = require('../src/book-archive.js');
globalThis.ImageLib = require('../src/imagelib.js');
globalThis.Hints = require('../src/hints.js');
globalThis.BookLang = require('../src/book-lang.js');
globalThis.Docx = require('../src/docx.js');
globalThis.DocxImport = require('../src/docx-import.js');
globalThis.Format = require('../src/format.js');
globalThis.Shortcuts = require('../src/shortcuts.js');
globalThis.ProjectLink = require('../src/projectlink.js');
globalThis.Splice = require('../src/splice.js');
globalThis.BookIndex = require('../src/book-index.js');
globalThis.Prose = require('../src/prose.js');

globalThis.withTestCover = function (files, path) {
    const next = Object.assign({}, files);
    const model = Book.read(next, { assets: [path] }).model;
    next[model.opfPath] = XmlAst.applyEdits(next[model.opfPath], OpfEdit.addItem(model, {
        id: 'cover-image', path: path, mediaType: 'image/png', properties: ['cover-image']
    }));
    return next;
};

require('./html-ast.test.js');
require('./css-ast.test.js');
require('./xml-ast.test.js');
require('./book-template.test.js');
require('./book.test.js');
require('./opf-edit.test.js');
require('./nav.test.js');
require('./xhtml.test.js');
require('./book-chapters.test.js');
require('./book-notes.test.js');
require('./book-blocks.test.js');
require('./book-export.test.js');
require('./epub.test.js');
require('./book-archive.test.js');
require('./markdown-import.test.js');
require('./roundtrip.test.js');
require('./epubcheck.test.js');
require('./hints.test.js');
require('./docx.test.js');
require('./docx-oracle.test.js');
require('./ace.test.js');
require('./format.test.js');
require('./shortcuts.test.js');
require('./projectlink.test.js');
require('./filesync.test.js');
require('./source-fixtures.test.js');
require('./book-index.test.js');
require('./prose.test.js');
require('./store-schema.test.js');
require('./book-recovery.test.js');
require('./codeshade.test.js');
require('./theme.test.js');
require('./project.test.js');
require('./structure.test.js');

harness.runTestsAsync().then((results) => {
    let failed = 0;
    for (const r of results) {
        if (r.ok) console.log('  ok   ' + r.name);
        else { failed++; console.log('  FAIL ' + r.name + '\n         ' + r.error); }
    }
    console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
    process.exit(failed ? 1 : 0);
});
