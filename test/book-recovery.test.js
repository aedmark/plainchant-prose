function recoverySnapshot(revision, text, deletedAt) {
    const book = { id: 'book-1', title: 'Book', createdAt: 1, updatedAt: revision + 1, revision: revision };
    if (deletedAt !== undefined) book.deletedAt = deletedAt;
    return { book: book, files: [
        { bookId: 'book-1', path: 'book.txt', role: 'index', kind: 'text', text: 'one.md\n',
            revision: revision, updatedAt: revision + 1 },
        { bookId: 'book-1', path: 'one.md', role: 'chapter', kind: 'text', text: text,
            revision: revision, updatedAt: revision + 1 }
    ] };
}

test('book recovery: a versioned per-book record carries exact text after-images and explicit removals', () => {
    const record = BookRecovery.make('book-1', 4, [
        { path: 'two.md', role: 'chapter', kind: 'text', text: '' },
        { path: 'book.txt', role: 'index', kind: 'text', text: 'two.md\n' }
    ], ['one.md'], 20, 3);
    assert.equal(BookRecovery.key('book-1'), 'plainchant_prose_book_emergency:book-1');
    assert.deepEqual(record.files.map((file) => file.path), ['book.txt', 'two.md']);
    assert.deepEqual(record.removePaths, ['one.md']);
    assert.equal(BookRecovery.validate(record).status, 'valid');
    assert.equal(BookRecovery.validate(Object.assign({}, record, { removePaths: ['book.txt'] })).status, 'invalid');
    assert.equal(BookRecovery.validate(Object.assign({}, record, { files: [
        { path: 'research/wrong.md', role: 'chapter', kind: 'text', text: '# Wrong' }
    ] })).status, 'invalid');
});

test('book recovery: reconciliation applies only the exact base and never guesses a conflict winner', () => {
    const pending = BookRecovery.make('book-1', 0,
        [{ path: 'one.md', role: 'chapter', kind: 'text', text: '# Recovered\n' }], [], 10, 1);
    assert.equal(BookRecovery.reconcile(pending, recoverySnapshot(0, '# Before\n'), []).status, 'apply');
    assert.equal(BookRecovery.reconcile(pending, recoverySnapshot(1, '# Recovered\n'), []).status, 'already-durable');
    assert.equal(BookRecovery.reconcile(pending, recoverySnapshot(1, '# Another writer\n'), []).status, 'conflict');
    assert.equal(BookRecovery.reconcile(pending, recoverySnapshot(0, '# Before\n'), [{ id: 'intent' }]).status,
        'pending-intent');
    assert.equal(BookRecovery.reconcile(pending, recoverySnapshot(0, '# Before\n', 11), []).status, 'book-deleted');
    assert.equal(BookRecovery.reconcile(pending, null, []).status, 'book-missing');
});

test('book recovery: empty text is content and omission never means deletion', () => {
    const empty = BookRecovery.make('book-1', 0,
        [{ path: 'one.md', role: 'chapter', kind: 'text', text: '' }], [], 10, 1);
    assert.equal(BookRecovery.validate(empty).status, 'valid');
    assert.deepEqual(empty.removePaths, []);
    assert.equal(BookRecovery.reconcile(empty, recoverySnapshot(0, '# Before\n'), []).status, 'apply');
});

test('book recovery: thirty days changes the warning and never requests physical deletion', () => {
    const day = 24 * 60 * 60 * 1000;
    const book = recoverySnapshot(0, '# One\n', 100).book;
    const before = BookRecovery.retention(book, 100 + 30 * day - 1);
    const boundary = BookRecovery.retention(book, 100 + 30 * day);
    assert.equal(before.status, 'recoverable');
    assert.equal(before.remaining, 1);
    assert.equal(boundary.status, 'expired-warning');
    assert.equal(boundary.physicallyDeleted, false);
});

test('book recovery: pure rules contain no browser, IndexedDB, timer, or native dependency', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'book-recovery.js'), 'utf8');
    ['indexedDB', 'IDBKeyRange', 'localStorage', 'setTimeout', 'document.', '__TAURI__'].forEach((needle) => {
        assert.excludes(source, needle);
    });
});
