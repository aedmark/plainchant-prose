const fs = require('fs');
const path = require('path');

const fixtureRoot = path.join(__dirname, 'fixtures', 'prose-source');
const expectedIds = [
    'chapter-conflicts',
    'encoded-ranges',
    'index-conflicts',
    'metadata-conflicts',
    'precedence-escaping',
    'valid-full',
    'valid-minimal'
];

function loadFixtures() {
    return fs.readdirSync(fixtureRoot, { withFileTypes: true })
        .filter(function (entry) { return entry.isDirectory(); })
        .map(function (entry) {
            const dir = path.join(fixtureRoot, entry.name);
            const expectedPath = path.join(dir, 'expected.json');
            return {
                dir: dir,
                manifest: JSON.parse(fs.readFileSync(expectedPath, 'utf8'))
            };
        })
        .sort(function (a, b) { return a.manifest.id.localeCompare(b.manifest.id); });
}

function sourceFor(fixture, document) {
    if (Object.prototype.hasOwnProperty.call(document, 'source')) return document.source;
    const resolved = path.resolve(fixture.dir, document.path);
    assert.ok(resolved.startsWith(fixture.dir + path.sep), 'fixture document must stay inside its case directory');
    return fs.readFileSync(resolved, 'utf8');
}

function documentId(document) {
    return document.path || document.id;
}

function assertRange(source, range, label) {
    assert.ok(Number.isInteger(range.start) && Number.isInteger(range.end), label + ' uses integer offsets');
    assert.ok(range.start >= 0 && range.end >= range.start && range.end <= source.length,
        label + ' stays inside its UTF-16 source');
    assert.equal(source.slice(range.start, range.end), range.text, label + ' records the exact source slice');
}

function listSourceFiles(dir, prefix) {
    const files = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
        const relative = prefix ? prefix + '/' + entry.name : entry.name;
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push.apply(files, listSourceFiles(absolute, relative));
        else if (entry.name !== 'expected.json') files.push(relative.normalize('NFC'));
    });
    return files.sort();
}

test('P1-01 source fixture set is complete and uniquely identified', function () {
    const fixtures = loadFixtures();
    assert.deepEqual(fixtures.map(function (fixture) { return fixture.manifest.id; }), expectedIds);
    fixtures.forEach(function (fixture) {
        const manifest = fixture.manifest;
        assert.ok(Array.isArray(manifest.features) && manifest.features.length > 0, manifest.id + ' names features');
        assert.ok(Array.isArray(manifest.documents) && manifest.documents.length > 0, manifest.id + ' names documents');
        assert.ok(Array.isArray(manifest.diagnostics), manifest.id + ' names diagnostics');
        assert.equal(typeof manifest.exportBlocking, 'boolean', manifest.id + ' records the export gate');
    });
});

test('P1-01 fixture ranges are exact half-open UTF-16 slices', function () {
    loadFixtures().forEach(function (fixture) {
        const ids = new Set();
        fixture.manifest.documents.forEach(function (document) {
            const id = documentId(document);
            assert.ok(id && !ids.has(id), fixture.manifest.id + ' has one document named ' + id);
            ids.add(id);
            assert.ok(Array.isArray(document.ranges), fixture.manifest.id + '/' + id + ' names ranges');
            const source = sourceFor(fixture, document);
            document.ranges.forEach(function (range) {
                assertRange(source, range, fixture.manifest.id + '/' + id + '/' + range.id);
            });
        });

        const physical = listSourceFiles(fixture.dir, '');
        const declared = fixture.manifest.documents
            .filter(function (document) { return document.path; })
            .map(function (document) { return document.path.normalize('NFC'); })
            .sort();
        assert.deepEqual(declared, physical, fixture.manifest.id + ' declares every physical source file');
    });
});

test('P1-01 fixture diagnostics retain exact source and export effects', function () {
    loadFixtures().forEach(function (fixture) {
        const sources = new Map();
        fixture.manifest.documents.forEach(function (document) {
            sources.set(documentId(document), sourceFor(fixture, document));
        });
        fixture.manifest.diagnostics.forEach(function (diagnostic) {
            assert.ok(/^[a-z][a-z0-9-]+$/.test(diagnostic.code), diagnostic.code + ' is stable kebab case');
            assert.ok(diagnostic.severity === 'warning' || diagnostic.severity === 'conflict',
                diagnostic.code + ' has a supported severity');
            assert.equal(typeof diagnostic.exportBlocking, 'boolean', diagnostic.code + ' records its export effect');
            assert.ok(sources.has(diagnostic.document), diagnostic.code + ' names a declared document');
            if (Object.prototype.hasOwnProperty.call(diagnostic, 'start')) {
                assertRange(sources.get(diagnostic.document), diagnostic,
                    fixture.manifest.id + '/diagnostic/' + diagnostic.code);
            } else {
                assert.ok(!Object.prototype.hasOwnProperty.call(diagnostic, 'end') &&
                    !Object.prototype.hasOwnProperty.call(diagnostic, 'text'),
                diagnostic.code + ' omits the whole unavailable range');
            }
        });
        const hasBlocker = fixture.manifest.diagnostics.some(function (diagnostic) {
            return diagnostic.exportBlocking;
        });
        assert.equal(fixture.manifest.exportBlocking, hasBlocker,
            fixture.manifest.id + ' export gate agrees with its diagnostics');
    });
});

test('P1-01 fixtures cover every approved grammar risk', function () {
    const covered = new Set();
    loadFixtures().forEach(function (fixture) {
        fixture.manifest.features.forEach(function (feature) { covered.add(feature); });
    });
    [
        'required-metadata', 'optional-metadata', 'custom-metadata', 'duplicate-standard-metadata',
        'unknown-metadata', 'parts', 'nested-paths', 'unsafe-paths', 'unicode-colliding-paths',
        'chapter-title', 'section-headings', 'scenes', 'synopses', 'multiline-notes',
        'multiline-boneyards', 'emphasis', 'quotes', 'footnotes', 'footnote-continuation',
        'escaping', 'precedence', 'unsupported-markdown', 'raw-html', 'crlf', 'bom',
        'astral-utf16-ranges', 'malformed-editable'
    ].forEach(function (feature) {
        assert.ok(covered.has(feature), 'fixture set covers ' + feature);
    });
});
