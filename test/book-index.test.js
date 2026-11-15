const bookIndexFs = require('fs');
const bookIndexPath = require('path');

function indexIds(index) {
    return index.orderItems.map(function (item) { return item.id; });
}

function reorderByPath(source, paths) {
    const index = BookIndex.read(source);
    const parts = index.orderItems.filter(function (item) { return item.type === 'part'; });
    const chapters = paths.map(function (chapterPath) {
        return index.chapterEntries.find(function (entry) { return entry.path === chapterPath; });
    });
    const plan = BookIndex.reorder(source, index, parts.concat(chapters).map(function (item) { return item.id; }));
    assert.ok(plan.ok, plan.message);
    return Splice.apply(source, plan.edits);
}

test('splice: applies strict non-overlapping UTF-16 range edits without touching the input', function () {
    const source = 'a🚀bcdef';
    const output = Splice.apply(source, [
        { start: 6, end: 7, text: 'E' },
        { start: 3, end: 4, text: 'B' },
        { start: source.length, end: source.length, text: '!' }
    ]);
    assert.equal(output, 'a🚀BcdEf!');
    assert.equal(source, 'a🚀bcdef');
    assert.equal(Splice.apply(source, []), source);
});

test('splice: refuses overlap, shared starts, invalid ranges, and non-string replacements before applying', function () {
    function codeFor(edits) {
        try {
            Splice.apply('abcdef', edits);
        } catch (problem) {
            return problem.code;
        }
        return null;
    }
    assert.equal(codeFor([{ start: 1, end: 4, text: '' }, { start: 3, end: 5, text: '' }]),
        'edit-ranges-overlap');
    assert.equal(codeFor([
        { start: 0, end: 6, text: '' },
        { start: 1, end: 2, text: '' },
        { start: 3, end: 4, text: '' }
    ]), 'edit-ranges-overlap', 'a long earlier edit still conflicts after a nested edit');
    assert.equal(codeFor([{ start: 1, end: 1, text: 'x' }, { start: 1, end: 1, text: 'y' }]),
        'edit-ranges-overlap');
    assert.equal(codeFor([{ start: 2, end: 9, text: '' }]), 'edit-range-outside-source');
    assert.equal(codeFor([{ start: 1.5, end: 2, text: '' }]), 'edit-range-not-integer');
    assert.equal(codeFor([{ start: 1, end: 2, text: 4 }]), 'edit-text-not-string');
});

test('book-index: reads immutable ranged metadata and order records with BOM, CRLF, and astral text', function () {
    const source = '\uFEFFTitle: Orbit 🚀\r\nAuthor: A. Writer\r\nLanguage: en\r\nCustom: Edition = First\r\n\r\n' +
        'Part: Launch\r\nchapters/01.md\r\n';
    const index = BookIndex.read(source);
    assert.ok(Object.isFrozen(index) && Object.isFrozen(index.orderItems));
    assert.equal(index.rangeUnit, 'utf16-code-unit');
    assert.equal(index.lineEnding, '\r\n');
    assert.equal(index.metadata.title.value, 'Orbit 🚀');
    assert.equal(source.slice(index.metadata.title.range.start, index.metadata.title.range.end), 'Title: Orbit 🚀');
    assert.equal(source.slice(index.orderItems[0].range.start, index.orderItems[0].range.end), 'Part: Launch');
    assert.deepEqual(index.diagnostics.map(function (problem) { return problem.code; }), ['source-bom']);
    assert.equal(index.exportBlocking, false);
    assert.equal(index.orderedSource, source.slice(index.orderedRange.start));
});

test('book-index: reordering preserves metadata, spacing, line endings, and untouched suffix bytes', function () {
    const source = ' Title : Salt 🚀  \r\nAuthor:\tA. Writer\r\nLanguage: en\r\nImprint: preserved conflict\r\n\r\n' +
        '\r\n  Part: One  \r\n  chapters/01.md\t\r\n\r\n\tchapters/02.md  \r\n\r\n';
    const index = BookIndex.read(source);
    const wanted = [index.orderItems[0].id, index.orderItems[2].id, index.orderItems[1].id];
    const plan = BookIndex.reorder(source, index, wanted);
    assert.ok(plan.ok);
    assert.equal(plan.edits.length, 1);
    assert.deepEqual({ start: plan.edits[0].start, end: plan.edits[0].end }, index.orderRange);
    const output = Splice.apply(source, plan.edits);
    assert.equal(output.slice(0, index.orderRange.start), source.slice(0, index.orderRange.start));
    assert.equal(output.slice(output.length - (source.length - index.orderRange.end)), source.slice(index.orderRange.end));
    assert.includes(output, '  Part: One  \r\n\tchapters/02.md  \r\n\r\n  chapters/01.md\t\r\n');
    assert.deepEqual(BookIndex.read(output).chapterEntries.map(function (entry) { return entry.path; }),
        ['chapters/02.md', 'chapters/01.md']);
    assert.equal((output.match(/\r\n/g) || []).length, (source.match(/\r\n/g) || []).length);

    const noOp = BookIndex.reorder(source, index, indexIds(index));
    assert.ok(noOp.ok);
    assert.deepEqual(noOp.edits, []);
    assert.equal(Splice.apply(source, noOp.edits), source);

    const restored = reorderByPath(output, ['chapters/01.md', 'chapters/02.md']);
    assert.equal(restored, source, 'inverse order restores every original code unit');
});

test('book-index: range identities distinguish duplicate source text', function () {
    const source = 'Title: Duplicates\nAuthor: A. Writer\nLanguage: en\n\n01.md\n01.md\n';
    const index = BookIndex.read(source);
    assert.equal(index.chapterEntries.length, 2);
    assert.ok(index.chapterEntries[0].id !== index.chapterEntries[1].id);
    assert.equal(source.slice(index.chapterEntries[0].range.start, index.chapterEntries[0].range.end), '01.md');
    assert.equal(source.slice(index.chapterEntries[1].range.start, index.chapterEntries[1].range.end), '01.md');
    assert.equal(index.diagnostics.find(function (problem) {
        return problem.code === 'chapter-path-duplicate';
    }).exportBlocking, true);
});

test('book-index: unresolved unknown lines inside the moved span block an ambiguous reorder', function () {
    const source = 'Title: Unknown\nAuthor: A. Writer\nLanguage: en\n\n01.md\n# comment-like unknown\n02.md\n';
    const index = BookIndex.read(source);
    const plan = BookIndex.reorder(source, index, indexIds(index).reverse());
    assert.equal(plan.ok, false);
    assert.equal(plan.code, 'index-order-unknown-line');
    assert.deepEqual(plan.edits, []);
    assert.equal(source.slice(index.unknownLines[0].range.start, index.unknownLines[0].range.end),
        '# comment-like unknown');
});

test('book-index: unknown lines outside the moved span remain byte-identical', function () {
    const source = 'Title: Outside\nAuthor: A. Writer\nLanguage: en\n\n01.md\n02.md\n# trailing unknown\n';
    const index = BookIndex.read(source);
    const plan = BookIndex.reorder(source, index, indexIds(index).reverse());
    assert.ok(plan.ok);
    const output = Splice.apply(source, plan.edits);
    assert.ok(output.endsWith('\n# trailing unknown\n'));
    assert.deepEqual(BookIndex.read(output).chapterEntries.map(function (entry) { return entry.path; }),
        ['02.md', '01.md']);
});

test('book-index: stale source and incomplete, repeated, or unknown identities produce no edit', function () {
    const source = 'Title: Safe\nAuthor: A. Writer\nLanguage: en\n\n01.md\n02.md\n';
    const index = BookIndex.read(source);
    assert.equal(BookIndex.reorder(source.replace('01.md', '03.md'), index, indexIds(index)).code,
        'index-order-stale-source');
    assert.equal(BookIndex.reorder(source, index, [index.orderItems[0].id]).code, 'index-order-incomplete');
    assert.equal(BookIndex.reorder(source, index, [index.orderItems[0].id, index.orderItems[0].id]).code,
        'index-order-invalid-identity');
    assert.equal(BookIndex.reorder(source, index, [index.orderItems[0].id, 'chapter@unknown']).code,
        'index-order-invalid-identity');
});

test('book-index: empty order is a stable no-op and configured source limits cannot be raised', function () {
    const empty = 'Title: Empty\nAuthor: A. Writer\nLanguage: en\n\n';
    const index = BookIndex.read(empty);
    assert.deepEqual(BookIndex.reorder(empty, index, []).edits, []);
    const refused = BookIndex.read('Title: long', { maxSourceLength: 5 });
    assert.equal(refused.diagnostics[0].code, 'source-too-large');
    assert.equal(refused.exportBlocking, true);
    assert.equal(BookIndex.reorder('Title: long', refused, []).code, 'index-order-unreadable');
    const overHardLimit = 'x'.repeat(BookIndex.MAX_SOURCE_LENGTH + 1);
    assert.equal(BookIndex.read(overHardLimit, { maxSourceLength: BookIndex.MAX_SOURCE_LENGTH + 100 }).diagnostics[0].code,
        'source-too-large');
});

test('book-index: Prose delegates book.txt grammar to the index reader without mutating input', function () {
    const proseSource = bookIndexFs.readFileSync(bookIndexPath.join(__dirname, '..', 'src', 'prose.js'), 'utf8');
    assert.includes(proseSource, 'BookIndex.read(source, options)');
    ['metadata-unknown-key', 'chapter-path-duplicate', 'index-unknown-line'].forEach(function (grammarCode) {
        assert.excludes(proseSource, grammarCode, 'book grammar code lives only in book-index.js');
    });
    const files = {
        'book.txt': 'Title: Shared\nAuthor: A. Writer\nLanguage: en\n\n01.md\n',
        '01.md': '# One\n\nText.\n'
    };
    const before = JSON.stringify(files);
    const index = BookIndex.read(files['book.txt']);
    const book = Prose.parse(files);
    assert.deepEqual(book.metadataEntries, index.metadataEntries);
    assert.deepEqual(book.chapterEntries, index.chapterEntries);
    assert.equal(JSON.stringify(files), before);
});

test('book-index: pure index and splice modules contain no browser, storage, native, or Node-only access', function () {
    ['book-index.js', 'splice.js'].forEach(function (file) {
        const source = bookIndexFs.readFileSync(bookIndexPath.join(__dirname, '..', 'src', file), 'utf8');
        ['window', 'document', 'indexedDB', '__TAURI', 'require('].forEach(function (name) {
            assert.excludes(source, name, file + ' excludes ' + name);
        });
    });
});
