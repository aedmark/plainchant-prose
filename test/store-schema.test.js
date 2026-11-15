const fsStore = require('fs');
const pathStore = require('path');

function storedBook(overrides) {
    return Object.assign({ id: 'book-1', title: 'A Book', createdAt: 10, updatedAt: 10, revision: 0 }, overrides || {});
}

function storedText(path, role, text, overrides) {
    return Object.assign({
        bookId: 'book-1', path: path, role: role, kind: 'text', text: text, revision: 0, updatedAt: 10
    }, overrides || {});
}

test('store schema: v3 has separate Prose records without replacing inherited v2 stores', () => {
    assert.equal(StoreSchema.DB_VERSION, 3);
    assert.deepEqual(StoreSchema.STORE_NAMES, {
        books: 'books', files: 'bookFiles', ui: 'bookUi', versions: 'bookVersions',
        versionFiles: 'bookVersionFiles', intents: 'bookIntents', targets: 'targets',
        links: 'folderLinks', handoffs: 'handoffs', meta: 'meta'
    });
    const source = fsStore.readFileSync(pathStore.join(__dirname, '..', 'src', 'store.js'), 'utf8');
    ['scripts', 'versions', 'files', 'assets'].forEach((name) => {
        assert.includes(source, "const " + (name === 'scripts' ? 'SCRIPTS' : name.toUpperCase()) + " = '" + name + "'");
    });
    assert.includes(source, "'prose.legacyV2Present'");
});

test('store schema: one book.txt and bounded, separated chapter and research files form a snapshot', () => {
    const book = storedBook();
    const valid = [storedText('book.txt', 'index', 'Title: A Book'), storedText('one.md', 'chapter', '# One'),
        storedText('research/notes.txt', 'research', 'private')];
    assert.ok(StoreSchema.validateSnapshot(book, valid).ok);
    assert.equal(StoreSchema.validateSnapshot(book, valid.slice(1)).code, 'book-index-count-invalid');
    assert.equal(StoreSchema.validateSnapshot(book, valid.concat(storedText('book.txt', 'index', 'again'))).code,
        'book-file-path-duplicate');
    assert.equal(StoreSchema.validateFile(storedText('research', 'research', 'x'), false).code,
        'file-research-path-invalid');
    assert.equal(StoreSchema.validateFile(storedText('research/chapter.md', 'chapter', '# wrong'), false).code,
        'file-chapter-path-invalid');
});

test('store schema: text and binary limits are explicit and binary equality requires a fingerprint', () => {
    const tooLong = storedText('one.md', 'chapter', 'x'.repeat(StoreSchema.MAX_TEXT_LENGTH + 1));
    assert.equal(StoreSchema.validateFile(tooLong, false).code, 'file-text-invalid');
    const blob = { size: 12, type: 'image/png' };
    const binary = { bookId: 'book-1', path: 'research/map.png', role: 'research', kind: 'binary', blob: blob,
        fingerprint: 'sha256:a', revision: 0, updatedAt: 10 };
    assert.ok(StoreSchema.validateFile(binary, false).ok);
    assert.equal(StoreSchema.validateFile(Object.assign({}, binary, { fingerprint: '' }), false).code,
        'file-binary-invalid');
    assert.ok(StoreSchema.sameFile(binary, Object.assign({}, binary, { blob: { size: 12, type: 'image/png' } })));
    assert.ok(!StoreSchema.sameFile(binary, Object.assign({}, binary, { fingerprint: 'sha256:b' })));
});

test('store schema: recoverable intents have unique paths and exact before and after identities', () => {
    const before = storedText('one.md', 'chapter', '# Before');
    const after = storedText('one.md', 'chapter', '# After', { revision: 1, updatedAt: 20 });
    const intent = { id: 'intent-1', bookId: 'book-1', state: 'prepared', baseRevision: 0, createdAt: 20,
        changes: [{ path: 'one.md', before: before, after: after }] };
    assert.ok(StoreSchema.validateIntent(intent).ok);
    assert.equal(StoreSchema.validateIntent(Object.assign({}, intent, {
        changes: intent.changes.concat(intent.changes[0])
    })).code, 'intent-path-invalid');
    assert.equal(StoreSchema.validateIntent(Object.assign({}, intent, { state: 'applied' })).code,
        'intent-applied-revision-invalid');
    assert.ok(StoreSchema.sameFile(before, Object.assign({}, before, { revision: 99, updatedAt: 99 })),
        'book revision supplies the concurrency identity while sameFile compares exact content');
    assert.ok(!StoreSchema.sameFile(before, after));
});

test('store schema: a version is a complete bounded book snapshot', () => {
    const version = { id: 'version-1', bookId: 'book-1', takenAt: 20, revision: 1 };
    const index = Object.assign({}, storedText('book.txt', 'index', 'Title: A Book'), { versionId: 'version-1' });
    const chapter = Object.assign({}, storedText('one.md', 'chapter', '# One'), { versionId: 'version-1' });
    delete index.revision;
    delete index.updatedAt;
    delete chapter.revision;
    delete chapter.updatedAt;
    assert.ok(StoreSchema.validateVersionSnapshot(version, [index, chapter]).ok);
    assert.equal(StoreSchema.validateVersionSnapshot(version, [chapter]).code, 'version-index-count-invalid');
    assert.equal(StoreSchema.validateVersionSnapshot(version, [index, Object.assign({}, chapter, {
        versionId: 'version-2'
    })]).code, 'version-file-owner-mismatch');
});

test('store schema: folder-link metadata records fingerprints but cannot carry filesystem authority', () => {
    const link = { bookId: 'book-1', displayName: 'Novel', platform: 'linux',
        fingerprints: [{ path: 'book.txt', fingerprint: 'sha256:abc' }] };
    assert.ok(StoreSchema.validateAuxiliary('folder-link', link).ok);
    assert.equal(StoreSchema.validateAuxiliary('folder-link', Object.assign({}, link, {
        rootPath: '/home/writer/novel'
    })).code, 'folder-link-authority-invalid');
    const source = fsStore.readFileSync(pathStore.join(__dirname, '..', 'src', 'store-schema.js'), 'utf8');
    assert.excludes(source, 'canonicalRoot');
});

test('store schema: failures remain distinct for quota, newer schema, abort, conflict, and closed state', () => {
    const named = (name) => ({ name: name });
    assert.equal(StoreSchema.classifyError(named('QuotaExceededError')).code, 'storage-quota');
    assert.equal(StoreSchema.classifyError(named('VersionError')).code, 'storage-newer-schema');
    assert.equal(StoreSchema.classifyError(named('AbortError')).code, 'storage-aborted');
    assert.equal(StoreSchema.classifyError(named('ConstraintError')).code, 'storage-conflict');
    assert.equal(StoreSchema.classifyError(named('InvalidStateError')).code, 'storage-closed');
    assert.equal(StoreSchema.classifyError({ code: 'book-revision-conflict' }).code, 'book-revision-conflict');
});

test('store adapter: rejects malformed change plans before opening a transaction', () => {
    const db = { transaction: function () { throw new Error('transaction should not open'); } };
    let code = null;
    try { Store.applyBookChange(db, { bookId: 'book-1' }); } catch (problem) { code = problem.code; }
    assert.equal(code, 'book-change-invalid');
});

test('store schema: pure rules do not import environment or persistence APIs', () => {
    const source = fsStore.readFileSync(pathStore.join(__dirname, '..', 'src', 'store-schema.js'), 'utf8');
    ['indexedDB', 'IDBKeyRange', 'window.', 'document.', 'localStorage', 'require('].forEach((needle) => {
        assert.excludes(source, needle);
    });
});
