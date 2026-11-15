/*
 * EPUBCheck is the optional EPUB 3.3 oracle (D-005). It runs only when Java and a jar are available. Missing or
 * explicitly skipped tooling reports "not run" and registers no passing test.
 */
const ecFs = require('fs');
const ecPath = require('path');
const ecOs = require('os');
const ecChild = require('child_process');

function findEpubcheck() {
    if (process.env.PROSE_SKIP_EPUBCHECK === '1') return { reason: 'PROSE_SKIP_EPUBCHECK=1' };
    let jar = process.env.EPUBCHECK_JAR || null;
    if (!jar) {
        const tools = ecPath.join(__dirname, '..', '.tools');
        const dirs = ecFs.existsSync(tools)
            ? ecFs.readdirSync(tools).filter((name) => /^epubcheck-[\d.]+$/.test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
            : [];
        const jars = dirs.map((name) => ecPath.join(tools, name, 'epubcheck.jar')).filter((file) => ecFs.existsSync(file));
        jar = jars.length ? jars[jars.length - 1] : null;
    }
    if (!jar || !ecFs.existsSync(jar)) return { reason: 'no EPUBCheck jar in .tools/ or EPUBCHECK_JAR' };
    try {
        ecChild.execFileSync('java', ['-version'], { stdio: 'ignore' });
    } catch (error) {
        return { reason: 'java is not on the PATH' };
    }
    return { jar: jar };
}

function epubcheckBytes(jar, bytes) {
    const dir = ecFs.mkdtempSync(ecPath.join(ecOs.tmpdir(), 'prose-epubcheck-'));
    try {
        const epub = ecPath.join(dir, 'book.epub');
        const report = ecPath.join(dir, 'report.json');
        ecFs.writeFileSync(epub, bytes);
        try {
            ecChild.execFileSync('java', ['-jar', jar, epub, '--json', report], { stdio: 'ignore' });
        } catch (error) {
            // EPUBCheck returns non-zero when it successfully reports validation errors.
        }
        return JSON.parse(ecFs.readFileSync(report, 'utf8'));
    } finally {
        ecFs.rmSync(dir, { recursive: true, force: true });
    }
}

function epubcheck(jar, files) {
    const entries = Object.keys(files).map((file) => ({ path: file, data: files[file] }));
    return epubcheckBytes(jar, Zip.build(entries));
}

function messages(report) {
    return report.messages.map((item) => item.severity + ' ' + item.ID + ': ' + item.message);
}

function expectClean(report, label) {
    assert.deepEqual(messages(report), [], label);
}

const epubcheckOracle = findEpubcheck();

if (!epubcheckOracle.jar) {
    console.log('  skip epubcheck: not run (' + epubcheckOracle.reason + ')');
} else {
    test('epubcheck: the retained minimal package passes the configured oracle', () => {
        expectClean(epubcheck(epubcheckOracle.jar, BookTemplate.create({ title: 'Ink & Ash', creator: 'A. Writer', language: 'fr-CA' }).files), 'minimal package');
    });

    test('epubcheck: retained OPF and navigation edits produce a valid package', () => {
        let files = BookTemplate.create({ title: 'Draft' }).files;
        files['OEBPS/text/chapter-2.xhtml'] = files['OEBPS/text/chapter-1.xhtml']
            .replace(/Chapter 1/g, 'Chapter 2').replace(/chapter-1/g, 'chapter-2');
        [
            (model) => OpfEdit.addItem(model, { id: 'chapter-2', path: 'OEBPS/text/chapter-2.xhtml', mediaType: 'application/xhtml+xml' }),
            (model) => OpfEdit.addItemref(model, 'chapter-2')
        ].forEach((operation) => {
            const model = Book.read(files).model;
            files['OEBPS/content.opf'] = XmlAst.applyEdits(files['OEBPS/content.opf'], operation(model));
        });
        const nav = Nav.read(files, Book.read(files).model).nav;
        files['OEBPS/nav.xhtml'] = XmlAst.applyEdits(files['OEBPS/nav.xhtml'], Nav.addEntry(nav, nav.toc, 'append', {
            label: 'Chapter 2', path: 'OEBPS/text/chapter-2.xhtml'
        }));
        expectClean(epubcheck(epubcheckOracle.jar, files), 'edited OPF and navigation');
    });

    test('epubcheck: the retained multi-chapter fixture passes the configured oracle', () => {
        expectClean(epubcheck(epubcheckOracle.jar, EpubFixture.create().files), 'multi-chapter fixture');
    });

    test('epubcheck: retained chapter, note, and block operations produce a valid package', () => {
        let files = EpubFixture.create().files;
        files = BookChapters.add(files, 'Interlude', 'OEBPS/text/chapter-1.xhtml').entries;
        const chapter = 'OEBPS/text/chapter-1.xhtml';
        const position = files[chapter].indexOf('Prose keeps them');
        files = BookNotes.insertAt(files, chapter, position, 'A retained note.', 'footnotes').entries;
        files = BookBlocks.insert(files, chapter, files[chapter].indexOf('<p>'), 'quote', {
            text: 'A retained quotation.', attribution: 'Fixture'
        }, []).entries;
        expectClean(epubcheck(epubcheckOracle.jar, files), 'retained document operations');
    });

    test('epubcheck: exported and re-imported retained packages stay valid', async () => {
        const files = EpubFixture.create().files;
        const first = await BookExport.pack(files, {});
        expectClean(epubcheckBytes(epubcheckOracle.jar, first.bytes), 'first export');
        const imported = await Epub.read(first.bytes);
        const second = await BookExport.pack(imported.entries, imported.binaries);
        expectClean(epubcheckBytes(epubcheckOracle.jar, second.bytes), 'second export');
    });

    test('epubcheck: retained Markdown and DOCX conversion output stays valid', async () => {
        const markdown = MarkdownImport.importInto(BookTemplate.create().files, [
            { name: 'draft.md', text: '# Opening\n\nOne.\n\n# Closing\n\nTwo.' }
        ], 'OEBPS/text/chapter-1.xhtml', {});
        expectClean(epubcheck(epubcheckOracle.jar, markdown.entries), 'Markdown conversion');

        const document = {
            title: 'A Document', creator: 'A. Writer', language: 'en',
            blocks: [{ type: 'heading', level: 1, runs: [{ text: 'Opening' }] }, { type: 'para', runs: [{ text: 'Text.' }] }],
            notes: {}, images: {}
        };
        const docx = DocxImport.newBook(document, { name: 'draft.docx' });
        expectClean(epubcheck(epubcheckOracle.jar, docx.entries), 'DOCX conversion');
    });
}
