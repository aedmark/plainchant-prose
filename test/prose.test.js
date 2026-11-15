const fs = require('fs');
const path = require('path');

const proseFixtureRoot = path.join(__dirname, 'fixtures', 'prose-source');

function loadProseCase(id) {
    const dir = path.join(proseFixtureRoot, id);
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
    const files = {};
    function walk(folder, prefix) {
        fs.readdirSync(folder, { withFileTypes: true }).forEach(function (entry) {
            if (entry.name === 'expected.json') return;
            const relative = prefix ? prefix + '/' + entry.name : entry.name;
            const absolute = path.join(folder, entry.name);
            if (entry.isDirectory()) walk(absolute, relative);
            else files[relative] = fs.readFileSync(absolute, 'utf8');
        });
    }
    walk(dir, '');
    return { expected: expected, files: files };
}

function comparableDiagnostic(problem, source) {
    const out = {
        code: problem.code,
        severity: problem.severity,
        document: problem.path
    };
    if (problem.range) {
        out.start = problem.range.start;
        out.end = problem.range.end;
        out.text = source.slice(problem.range.start, problem.range.end);
    }
    out.exportBlocking = problem.exportBlocking;
    return out;
}

function diagnosticSort(a, b) {
    return (a.document + ':' + String(a.start === undefined ? -1 : a.start).padStart(8, '0') + ':' + a.code)
        .localeCompare(b.document + ':' + String(b.start === undefined ? -1 : b.start).padStart(8, '0') + ':' + b.code);
}

function assertRangesInside(value, source, label, seen) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value.range && Number.isInteger(value.range.start) && Number.isInteger(value.range.end)) {
        assert.ok(value.range.start >= 0 && value.range.end >= value.range.start && value.range.end <= source.length,
            label + ' range stays inside source');
    }
    Object.keys(value).forEach(function (key) {
        if (key !== 'diagnostics') assertRangesInside(value[key], source, label + '.' + key, seen);
    });
}

test('prose: every P1-01 fixture produces its exact diagnostics and export gate', function () {
    fs.readdirSync(proseFixtureRoot, { withFileTypes: true })
        .filter(function (entry) { return entry.isDirectory(); })
        .forEach(function (entry) {
            const fixture = loadProseCase(entry.name);
            let actual = [];
            const sources = {};
            let exportBlocking = false;
            if (entry.name === 'encoded-ranges') {
                fixture.expected.documents.forEach(function (document) {
                    const chapter = Prose.parseChapter(document.source, document.id);
                    sources[document.id] = document.source;
                    actual.push.apply(actual, chapter.diagnostics);
                    exportBlocking = exportBlocking || chapter.exportBlocking;
                });
            } else {
                const book = Prose.parse(fixture.files);
                actual = book.diagnostics;
                Object.assign(sources, fixture.files);
                exportBlocking = book.exportBlocking;
            }
            actual.forEach(function (problem) {
                assert.ok(!Object.prototype.hasOwnProperty.call(problem, 'source'),
                    entry.name + ' diagnostics do not copy manuscript excerpts');
            });
            const got = actual.map(function (problem) {
                return comparableDiagnostic(problem, sources[problem.path] || '');
            }).sort(diagnosticSort);
            const wanted = fixture.expected.diagnostics.slice().sort(diagnosticSort);
            assert.deepEqual(got, wanted, entry.name + ' diagnostics match the normative fixture');
            assert.equal(exportBlocking, fixture.expected.exportBlocking, entry.name + ' export gate matches');
        });
});

test('prose: valid full book returns ranged metadata, parts, chapters, scenes, notes, and footnotes', function () {
    const fixture = loadProseCase('valid-full');
    const book = Prose.parse(fixture.files);
    assert.ok(Object.isFrozen(book) && Object.isFrozen(book.chapters[0]), 'derived models are immutable');
    assert.equal(book.rangeUnit, 'utf16-code-unit');
    assert.equal(book.metadata.title.value, 'The Salt Road');
    assert.equal(book.metadata.publishDate.value, '2026-11-14');
    assert.deepEqual(book.customMetadata.map(function (entry) { return entry.customName; }), ['Imprint', 'Edition']);
    assert.deepEqual(book.parts.map(function (part) { return part.title; }), ['Part One', 'Part Two']);
    assert.deepEqual(book.parts[0].chapters, ['chapters/01-harbour.md']);
    assert.equal(book.chapters.length, 2);

    const chapter = book.chapters[0];
    assert.equal(chapter.title.text, 'Harbour');
    assert.equal(chapter.scenes.length, 2);
    assert.equal(chapter.scenes[0].synopsis.text, 'Arrival at low tide');
    assert.equal(chapter.scenes[1].synopsis.text, 'The letter arrives');
    assert.equal(fixture.files[chapter.path].slice(chapter.scenes[1].breakRange.start,
        chapter.scenes[1].breakRange.end), '* * *');
    assert.equal(chapter.notes.length, 1);
    assert.equal(chapter.notes[0].text, 'private\nauthor note');
    assert.equal(chapter.boneyards.length, 1);
    assert.equal(chapter.footnotes.references[0].label, 'tide');
    assert.equal(chapter.footnotes.definitions[0].label, 'tide');
    assert.ok(chapter.blocks.some(function (block) { return block.type === 'quote'; }));
    assert.ok(chapter.blocks.some(function (block) { return block.type === 'scene-break'; }));
});

test('prose: all derived ranges remain valid UTF-16 slices, including CRLF, BOM, and astral text', function () {
    ['valid-minimal', 'valid-full', 'chapter-conflicts', 'precedence-escaping'].forEach(function (id) {
        const fixture = loadProseCase(id);
        const book = Prose.parse(fixture.files);
        assertRangesInside(book.metadataEntries, fixture.files['book.txt'], id + '.metadata', new Set());
        assertRangesInside(book.parts, fixture.files['book.txt'], id + '.parts', new Set());
        assertRangesInside(book.chapterEntries, fixture.files['book.txt'], id + '.entries', new Set());
        book.chapters.forEach(function (chapter) {
            assertRangesInside(chapter, fixture.files[chapter.path], id + '.' + chapter.path, new Set());
        });
    });
    const encoded = loadProseCase('encoded-ranges').expected.documents;
    encoded.forEach(function (document) {
        const chapter = Prose.parseChapter(document.source, document.id);
        assertRangesInside(chapter, document.source, document.id, new Set());
    });
    const astral = encoded.find(function (document) { return document.id === 'astral.md'; });
    assert.equal(astral.source.slice(14, 16), '🚀', 'astral ranges count two UTF-16 code units');
    const bom = Prose.parseChapter(encoded.find(function (document) { return document.id === 'bom.md'; }).source,
        'bom.md');
    assert.deepEqual(bom.title.range, { start: 1, end: 9 });
    const crlf = Prose.parseChapter(encoded.find(function (document) { return document.id === 'crlf.md'; }).source,
        'crlf.md');
    assert.equal(crlf.lineEnding, '\r\n');
});

test('prose: renderer escapes writer text and omits recognized private source', function () {
    const source = '# <img src=x onerror=alert(1)>\n\n' +
        'Before[[secret]]after <script>alert(1)</script> & **<b>**.[^n]\n\n' +
        '[^n]: <i>note</i>\n';
    const chapter = Prose.parseChapter(source, 'hostile.md');
    const html = Prose.toHTML(chapter);
    assert.excludes(html, '<img');
    assert.excludes(html, '<script');
    assert.excludes(html, '<b>');
    assert.excludes(html, 'secret');
    assert.includes(html, '&lt;img src=x onerror=alert(1)&gt;');
    assert.includes(html, 'Beforeafter &lt;script&gt;alert(1)&lt;/script&gt; &amp;');
    assert.includes(html, '<strong>&lt;b&gt;</strong>');
    assert.includes(html, '<li id="note-n">&lt;i&gt;note&lt;/i&gt;</li>');
});

test('prose: malformed private marks stay editable and block export', function () {
    const note = Prose.parseChapter('# Notes\n\nVisible [[private\n', 'note.md');
    assert.equal(note.diagnostics[0].code, 'note-unclosed');
    assert.ok(note.exportBlocking);
    assert.includes(Prose.toHTML(note), '[[private', 'unclosed source stays visible as literal text');

    const bone = Prose.parseChapter('# Cuts\n\nVisible /* private\n', 'bone.md');
    assert.equal(bone.diagnostics[0].code, 'boneyard-unclosed');
    assert.ok(bone.exportBlocking);
    assert.includes(Prose.toHTML(bone), '/* private');
});

test('prose: escapes and hidden precedence preserve literal delimiters', function () {
    const fixture = loadProseCase('precedence-escaping');
    const chapter = Prose.parse(fixture.files).chapters[0];
    const html = Prose.toHTML(chapter);
    assert.includes(html, '[[printed]] and /* printed */ and *plain*.');
    assert.excludes(html, 'note /* nested */');
    assert.excludes(html, 'bone [[nested]]');
    assert.includes(html, '<strong>bold</strong> and <em>italic</em> and *literal*.');
    assert.equal(chapter.notes.length, 1);
    assert.equal(chapter.boneyards.length, 1);
});

test('prose: footnote conflicts remain ranged and unused definitions do not block alone', function () {
    const duplicate = Prose.parseChapter('# Notes\n\nOne[^a] two[^a] missing[^b].\n\n[^a]: First\n[^a]: Second\n[^unused]: Kept\n',
        'notes.md');
    assert.deepEqual(duplicate.diagnostics.map(function (problem) { return problem.code; }), [
        'footnote-reference-duplicate',
        'footnote-definition-missing',
        'footnote-definition-duplicate',
        'footnote-definition-unused'
    ]);
    assert.ok(duplicate.exportBlocking);
    assert.includes(Prose.toHTML(duplicate), '[^a]', 'ambiguous references stay literal in preview');
    assert.excludes(Prose.toHTML(duplicate), 'role="doc-noteref"');
    duplicate.diagnostics.forEach(function (problem) {
        assert.equal(duplicate.path, problem.path);
        assert.equal(typeof problem.range.start, 'number');
    });

    const unused = Prose.parseChapter('# Notes\n\nText.\n\n[^unused]: Kept\n', 'unused.md');
    assert.equal(unused.diagnostics[0].code, 'footnote-definition-unused');
    assert.equal(unused.exportBlocking, false);
});

test('prose: hidden constructs outrank definition-shaped lines, while definition content stays literal', function () {
    const source = '# Order\n\n[[private\n[^hidden]: not a definition\n]]\n' +
        'Public[^shown].\n\n[^shown]: [[literal note marks]] and /* literal cuts */\n';
    const chapter = Prose.parseChapter(source, 'order.md');
    assert.equal(chapter.notes.length, 1, 'the outer author note consumes its definition-shaped line');
    assert.deepEqual(chapter.footnotes.definitions.map(function (definition) { return definition.label; }), ['shown']);
    assert.equal(chapter.diagnostics.length, 1);
    assert.equal(chapter.diagnostics[0].code, 'footnote-definition-unsupported');
    assert.equal(chapter.exportBlocking, false);
    const html = Prose.toHTML(chapter);
    assert.excludes(html, 'not a definition');
    assert.includes(html, '[[literal note marks]] and /* literal cuts */');
});

test('prose: block-looking lines inside multiline private source never become structure', function () {
    const source = '# Hidden\n\n[[private\n## false heading\n* * *\n> false quote\n- false list\n]]\nVisible.\n';
    const chapter = Prose.parseChapter(source, 'hidden.md');
    assert.equal(chapter.notes.length, 1);
    assert.equal(chapter.scenes.length, 1);
    assert.deepEqual(chapter.blocks.map(function (block) { return block.type; }), ['title', 'paragraph']);
    assert.deepEqual(chapter.diagnostics, []);
    const html = Prose.toHTML(chapter);
    assert.excludes(html, 'false heading');
    assert.excludes(html, '<hr>');
    assert.includes(html, 'Visible.');
});

test('prose: empty and nested quote markers remain literal diagnostics', function () {
    const chapter = Prose.parseChapter('# Quotes\n\n> \n> > nested\n', 'quotes.md');
    assert.deepEqual(chapter.diagnostics.map(function (problem) { return problem.code; }), [
        'quote-empty', 'quote-nested'
    ]);
    assert.includes(Prose.toHTML(chapter), '&gt;');
});

test('prose: parser refuses configured oversized input without environment access', function () {
    const chapter = Prose.parseChapter('# Too long\n', 'large.md', { maxSourceLength: 5 });
    assert.equal(chapter.diagnostics[0].code, 'source-too-large');
    assert.ok(chapter.exportBlocking);
    assert.equal(chapter.blocks.length, 0);
});

test('prose: metadata and index validation return explicit conflicts without choosing source', function () {
    const files = {
        'book.txt': 'Author:\nLanguage: en_US\nPublish Date: 2026-13-40\nCustom: Bad! = value\n\n' +
            '/absolute.md\na//b.md\nbad\u0001.md\n'
    };
    const book = Prose.parse(files);
    assert.deepEqual(book.diagnostics.map(function (problem) { return problem.code; }).sort(), [
        'chapter-path-absolute',
        'chapter-path-control',
        'chapter-path-traversal',
        'metadata-custom-invalid',
        'metadata-language-invalid',
        'metadata-publish-date-invalid',
        'metadata-required-empty',
        'metadata-required-missing'
    ].sort());
    assert.equal(book.metadata.title, undefined);
    assert.equal(book.metadata.author, null);
    assert.ok(book.exportBlocking);
});

test('prose: heading levels two through six print while malformed levels stay literal', function () {
    const source = '# Levels\n\n## Two\n### Three\n#### Four\n##### Five\n###### Six\n\n' +
        '##No space\n####### Seven\n## Ref[^a]\n\n[^a]: Unused here\n';
    const chapter = Prose.parseChapter(source, 'levels.md');
    assert.deepEqual(chapter.blocks.filter(function (block) { return block.type === 'heading'; })
        .map(function (block) { return block.level; }), [2, 3, 4, 5, 6, 2]);
    assert.deepEqual(chapter.diagnostics.map(function (problem) { return problem.code; }), [
        'heading-malformed',
        'heading-unsupported',
        'heading-footnote-unsupported',
        'footnote-definition-unused'
    ]);
    const html = Prose.toHTML(chapter);
    assert.includes(html, '<h6>Six</h6>');
    assert.includes(html, '####### Seven');
    assert.includes(html, 'Ref[^a]');
});

test('prose: emphasis whitespace, combined forms, and hard breaks remain literal when unsupported', function () {
    const source = '# Marks\n\n*italic* **bold** * open* *close * ***combined*** _under_  \nnext\n';
    const chapter = Prose.parseChapter(source, 'marks.md');
    const html = Prose.toHTML(chapter);
    assert.includes(html, '<em>italic</em> <strong>bold</strong>');
    assert.includes(html, '* open* *close * ***combined*** _under_');
    assert.deepEqual(chapter.diagnostics.map(function (problem) { return problem.code; }), [
        'inline-unsupported', 'inline-unsupported-hard-break'
    ]);
});

test('prose: pure parser has no browser, storage, native, or Node dependency', function () {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'prose.js'), 'utf8');
    ['window', 'document', 'indexedDB', '__TAURI', 'require('].forEach(function (name) {
        assert.excludes(source, name, 'pure parser excludes ' + name);
    });
    const files = {
        'book.txt': 'Title: Pure\nAuthor: A. Writer\nLanguage: en\n\n01.md\n',
        '01.md': '# One\n\nText.\n'
    };
    const before = JSON.stringify(files);
    Prose.parse(files);
    assert.equal(JSON.stringify(files), before, 'parsing never mutates the source map');
});

test('prose: bounded hostile strings always return in-range models and escaped HTML', function () {
    let state = 0x51f15e;
    function random() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    }
    const alphabet = 'abc XYZ0123*[]/\\>#=_-&;:\t';
    for (let sample = 0; sample < 200; sample++) {
        let body = sample % 10 === 0 ? '<script>alert(1)</script>' : '';
        const length = Math.floor(random() * 240);
        for (let i = 0; i < length; i++) {
            body += alphabet.charAt(Math.floor(random() * alphabet.length));
            if (random() < 0.04) body += '\n';
            if (random() < 0.01) body += '🚀';
        }
        const source = '# Fuzz ' + sample + '\n\n' + body;
        const chapter = Prose.parseChapter(source, 'fuzz.md');
        assertRangesInside(chapter, source, 'fuzz ' + sample, new Set());
        const html = Prose.toHTML(chapter);
        assert.excludes(html, '<script>');
    }
});
