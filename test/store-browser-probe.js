(function (root) {
    'use strict';

    function refuse(message) { throw new Error(message); }
    function check(value, message) { if (!value) refuse(message); }
    function requestResult(request) {
        return new Promise(function (resolve, reject) {
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }
    function transactionDone(tx) {
        return new Promise(function (resolve, reject) {
            tx.oncomplete = resolve;
            tx.onabort = tx.onerror = function () { reject(tx.error || new Error('transaction aborted')); };
        });
    }
    function deleteDatabase(name) {
        return new Promise(function (resolve, reject) {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = resolve;
            request.onerror = function () { reject(request.error); };
            request.onblocked = function () { reject(new Error('delete blocked: ' + name)); };
        });
    }
    function rawOpen(name, version, upgrade) {
        return new Promise(function (resolve, reject) {
            const request = indexedDB.open(name, version);
            request.onupgradeneeded = function (event) { if (upgrade) upgrade(request.result, request.transaction, event); };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
            request.onblocked = function () { reject(new Error('open blocked: ' + name)); };
        });
    }
    function installV2(db, tx) {
        db.createObjectStore('scripts', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
        db.createObjectStore('versions', { keyPath: 'id' }).createIndex('byScript', ['scriptId', 'takenAt']);
        db.createObjectStore('files', { keyPath: 'scriptId' });
        db.createObjectStore('assets', { keyPath: 'key' }).createIndex('byScript', 'scriptId');
        tx.objectStore('scripts').add({ id: 'legacy-1', content: 'legacy source', title: 'Legacy' });
        tx.objectStore('meta').add({ key: 'legacy-setting', value: 17 });
    }
    function book(id, revision, now) {
        return { id: id, title: 'Test Book', createdAt: 1, updatedAt: now, revision: revision };
    }
    function text(bookId, path, role, value, revision, now) {
        return { bookId: bookId, path: path, role: role, kind: 'text', text: value,
            revision: revision, updatedAt: now };
    }
    function initialFiles(id) {
        return [text(id, 'book.txt', 'index', 'Title: Test Book\nAuthor: Writer\nLanguage: en\n\none.md\n', 0, 1),
            text(id, 'one.md', 'chapter', '# One\n\nBefore.\n', 0, 1)];
    }
    async function expectCode(action, code) {
        try { await action(); } catch (problem) {
            if (problem && problem.code === code) return;
            refuse('expected ' + code + ', received ' + (problem && (problem.code || problem.name || problem.message)));
        }
        refuse('expected ' + code + ', operation succeeded');
    }

    async function freshAndRecovery(prefix) {
        const results = [];
        const freshName = prefix + '-fresh';
        await deleteDatabase(freshName);
        const opened = await Store.openBooks(indexedDB, { name: freshName });
        check(opened.status === 'ready' && opened.writable, 'fresh v3 did not open writable');
        const expectedStores = ['books', 'bookFiles', 'bookUi', 'bookVersions', 'bookVersionFiles', 'bookIntents',
            'targets', 'folderLinks', 'handoffs', 'scripts', 'versions', 'files', 'assets', 'meta'];
        expectedStores.forEach(function (name) { check(opened.db.objectStoreNames.contains(name), 'missing store ' + name); });
        const id = 'book-fresh';
        await Store.createBook(opened.db, { book: book(id, 0, 1), files: initialFiles(id),
            ui: { bookId: id, selectedPath: 'one.md' } });
        let loaded = await Store.loadBook(opened.db, id);
        check(loaded.files.length === 2 && loaded.book.revision === 0, 'created book did not load');
        await Store.applyBookChange(opened.db, { bookId: id, expectedRevision: 0, now: 2,
            putFiles: [text(id, 'one.md', 'chapter', '# One\n\nAfter.\n', 0, 1),
                text(id, 'two.md', 'chapter', '# Two\n', 0, 1)], removePaths: [] });
        loaded = await Store.loadBook(opened.db, id);
        check(loaded.book.revision === 1 && loaded.files.length === 3, 'multi-file write was not atomic');
        await expectCode(function () { return Store.applyBookChange(opened.db, {
            bookId: id, expectedRevision: 0, now: 3, putFiles: [], removePaths: []
        }); }, 'book-revision-conflict');
        results.push('fresh schema and monotonic change');

        const version = { id: 'version-1', bookId: id, takenAt: 3, revision: 1, name: 'Checkpoint' };
        await Store.createBookVersion(opened.db, version);
        await expectCode(function () { return Store.createBookVersion(opened.db, version); }, 'storage-conflict');
        const versionCount = await requestResult(opened.db.transaction(['bookVersionFiles'], 'readonly')
            .objectStore('bookVersionFiles').index('byVersion').count(IDBKeyRange.only(version.id)));
        check(versionCount === 3, 'failed version transaction changed snapshot files');
        const versionLoaded = await Store.loadBookVersion(opened.db, version.id);
        check(versionLoaded.files.length === 3 && (await Store.loadBookVersions(opened.db, id)).length === 1,
            'version records did not load as a complete snapshot');
        results.push('atomic version abort');

        const before = loaded.files.find(function (file) { return file.path === 'one.md'; });
        const after = text(id, 'one.md', 'chapter', '# One\n\nIntent.\n', 2, 4);
        const intent = { id: 'intent-1', bookId: id, state: 'prepared', baseRevision: 1, createdAt: 4,
            changes: [{ path: 'one.md', before: before, after: after }] };
        await Store.prepareIntent(opened.db, intent);
        check((await Store.loadBookIntents(opened.db, id)).length === 1, 'prepared intent did not load for recovery');
        let inspection = await Store.inspectBooks(opened.db);
        check(inspection.warnings.some(function (item) { return item.code === 'intent-prepared'; }),
            'prepared intent was not reported');
        await Store.applyIntent(opened.db, intent.id, 5);
        inspection = await Store.inspectBooks(opened.db);
        check(inspection.warnings.some(function (item) { return item.code === 'intent-applied'; }),
            'applied intent was not reported');
        await Store.resolveIntent(opened.db, intent.id, 'rollback', 6);
        loaded = await Store.loadBook(opened.db, id);
        check(loaded.book.revision === 3 && loaded.files.find(function (file) { return file.path === 'one.md'; }).text === before.text,
            'intent rollback did not restore its before-image');
        const cancel = { id: 'intent-cancel', bookId: id, state: 'prepared', baseRevision: 3, createdAt: 7,
            changes: [{ path: 'one.md', before: loaded.files.find(function (file) { return file.path === 'one.md'; }),
                after: text(id, 'one.md', 'chapter', '# Cancelled\n', 4, 7) }] };
        await Store.prepareIntent(opened.db, cancel);
        await Store.resolveIntent(opened.db, cancel.id, 'cancel', 7);
        check((await Store.inspectBooks(opened.db)).warnings.length === 0, 'cancelled intent remained pending');
        results.push('intent prepare, apply, rollback, and cancel');

        await Store.putTarget(opened.db, { bookId: id, words: 80000 });
        await Store.putFolderLink(opened.db, { bookId: id, displayName: 'Test Book', platform: 'linux',
            fingerprints: [{ path: 'book.txt', fingerprint: 'sha256:abc' }] });
        await Store.addHandoff(opened.db, { id: 'handoff-1', bookId: id, createdAt: 8, sourceRevision: 3,
            fileName: 'test-book.epub', fingerprint: 'sha256:def' });
        check((await Store.loadTargets(opened.db)).length === 1 && (await Store.loadHandoffs(opened.db)).length === 1,
            'auxiliary records did not round-trip');
        opened.db.close();
        results.push('separate auxiliary records');

        const legacyName = prefix + '-legacy';
        await deleteDatabase(legacyName);
        const legacy = await rawOpen(legacyName, 2, installV2);
        legacy.close();
        const upgraded = await Store.openBooks(indexedDB, { name: legacyName });
        check(upgraded.status === 'ready' && upgraded.legacyV2Present, 'v2 upgrade marker is missing');
        const legacyRecord = await requestResult(upgraded.db.transaction(['scripts'], 'readonly').objectStore('scripts').get('legacy-1'));
        const legacyMeta = await requestResult(upgraded.db.transaction(['meta'], 'readonly').objectStore('meta').get('legacy-setting'));
        check(legacyRecord.content === 'legacy source' && legacyMeta.value === 17, 'v2 records changed during upgrade');
        upgraded.db.close();
        results.push('v2 preservation');

        const rollbackName = prefix + '-upgrade-rollback';
        await deleteDatabase(rollbackName);
        const rollbackSeed = await rawOpen(rollbackName, 2, installV2);
        rollbackSeed.close();
        const refused = await Store.openBooks(indexedDB, { name: rollbackName, failUpgrade: true });
        check(refused.status === 'upgrade-failed', 'forced upgrade did not report upgrade-failed');
        const stillV2 = await rawOpen(rollbackName, 2);
        check(stillV2.version === 2 && !stillV2.objectStoreNames.contains('books'), 'aborted upgrade was partly committed');
        stillV2.close();
        const recoveredUpgrade = await Store.openBooks(indexedDB, { name: rollbackName });
        check(recoveredUpgrade.status === 'ready', 'database did not upgrade after forced rollback');
        recoveredUpgrade.db.close();
        results.push('upgrade rollback');

        const corruptName = prefix + '-corrupt';
        await deleteDatabase(corruptName);
        const corrupt = await Store.openBooks(indexedDB, { name: corruptName });
        await Store.createBook(corrupt.db, { book: book('book-corrupt', 0, 1), files: initialFiles('book-corrupt') });
        const tx = corrupt.db.transaction(['bookFiles'], 'readwrite');
        tx.objectStore('bookFiles').put({ bookId: 'book-corrupt', path: '../outside.md', role: 'chapter', kind: 'text',
            text: 'private manuscript text', revision: 0, updatedAt: 1 });
        await transactionDone(tx);
        corrupt.db.close();
        const recovery = await Store.openBooks(indexedDB, { name: corruptName });
        check(recovery.status === 'recovery-required' && !recovery.writable && recovery.problems.length > 0,
            'corrupt record did not produce read-only recovery');
        await expectCode(function () { return Store.applyBookChange(recovery.db, { bookId: 'book-corrupt',
            expectedRevision: 0, now: 2, putFiles: [], removePaths: [] }); }, 'storage-recovery-read-only');
        const rawCorrupt = await requestResult(recovery.db.transaction(['bookFiles'], 'readonly')
            .objectStore('bookFiles').get(['book-corrupt', '../outside.md']));
        check(rawCorrupt && rawCorrupt.text === 'private manuscript text', 'recovery inspection rewrote corrupt data');
        recovery.db.close();
        results.push('non-destructive corruption recovery');

        const unknownName = prefix + '-unknown-store';
        await deleteDatabase(unknownName);
        const unknown = await rawOpen(unknownName, 3, function (db, upgradeTx) {
            db.createObjectStore('futureRecords', { keyPath: 'id' });
            upgradeTx.objectStore('futureRecords').add({ id: 'future-1', opaque: 'keep me' });
        });
        unknown.close();
        const unknownResult = await Store.openBooks(indexedDB, { name: unknownName });
        check(unknownResult.status === 'recovery-required' &&
            unknownResult.problems.some(function (item) { return item.code === 'store-unknown'; }),
        'unknown schema topology did not enter recovery');
        const opaque = await requestResult(unknownResult.db.transaction(['futureRecords'], 'readonly')
            .objectStore('futureRecords').get('future-1'));
        check(opaque.opaque === 'keep me', 'unknown store data was not preserved');
        unknownResult.db.close();
        results.push('unknown schema preservation');

        const newerName = prefix + '-newer';
        await deleteDatabase(newerName);
        const newer = await rawOpen(newerName, 4, function (db) { db.createObjectStore('future', { keyPath: 'id' }); });
        newer.close();
        const newerResult = await Store.openBooks(indexedDB, { name: newerName });
        check(newerResult.status === 'newer-schema', 'newer schema was not distinguished');
        results.push('newer-schema refusal');
        return results;
    }

    async function race(name) {
        const opened = await Store.openBooks(indexedDB, { name: name });
        try {
            await Store.applyBookChange(opened.db, { bookId: 'race-book', expectedRevision: 0, now: Date.now(),
                putFiles: [text('race-book', 'one.md', 'chapter', '# Won by ' + root.name, 0, 1)], removePaths: [] });
            return 'won';
        } catch (problem) { return problem && problem.code; }
        finally { if (opened.db) opened.db.close(); }
    }

    async function seedRace(name) {
        await deleteDatabase(name);
        const opened = await Store.openBooks(indexedDB, { name: name });
        await Store.createBook(opened.db, { book: book('race-book', 0, 1), files: initialFiles('race-book') });
        opened.db.close();
        return true;
    }

    async function holdV2(name) {
        await deleteDatabase(name);
        root.__heldDatabase = await rawOpen(name, 2, installV2);
        return true;
    }
    function closeHeld() { if (root.__heldDatabase) root.__heldDatabase.close(); root.__heldDatabase = null; return true; }
    async function openResult(name) {
        const result = await Store.openBooks(indexedDB, { name: name });
        if (result.db) result.db.close();
        return { status: result.status, code: result.code || null };
    }
    async function holdStoreConnection(name) {
        root.__versionChanged = false;
        root.__storeConnection = await Store.connect(indexedDB, { name: name, onVersionChange: function () {
            root.__versionChanged = true;
        } });
        return true;
    }
    async function upgradeRaw(name) {
        const db = await rawOpen(name, 4, function (database) { database.createObjectStore('future', { keyPath: 'id' }); });
        db.close();
        return true;
    }
    function versionChangeState() {
        let closed = false;
        try { root.__storeConnection.transaction(['books'], 'readonly'); } catch (problem) {
            closed = problem && problem.name === 'InvalidStateError';
        }
        return { notified: root.__versionChanged, closed: closed };
    }
    async function quota(name) {
        await deleteDatabase(name);
        const opened = await Store.openBooks(indexedDB, { name: name });
        check(opened.status === 'ready', 'quota database did not open');
        const files = initialFiles('quota-book');
        files[1].text = 'x'.repeat(5 * 1024 * 1024);
        let code = null;
        try { await Store.createBook(opened.db, { book: book('quota-book', 0, 1), files: files }); }
        catch (problem) { code = problem && problem.code; }
        opened.db.close();
        return code;
    }

    function clock(start) {
        let value = start;
        return function () { value += 1; return value; };
    }

    async function persistence(prefix) {
        const results = [];
        const name = prefix + '-persistence';
        await deleteDatabase(name);
        localStorage.clear();
        const opened = await Store.openBooks(indexedDB, { name: name });
        const id = 'persistence-book';
        await Store.createBook(opened.db, { book: book(id, 0, 1), files: initialFiles(id) });
        const timerId = 'timer-book';
        await Store.createBook(opened.db, { book: book(timerId, 0, 1), files: initialFiles(timerId) });
        const delays = [];
        const timerSession = ProsePersistence.create({ db: opened.db, bookId: timerId, now: clock(5),
            setTimeout: function (fn, delay) { delays.push(delay); return delays.length; },
            clearTimeout: function () {}, BroadcastChannel: null });
        await timerSession.open();
        timerSession.putText('one.md', 'chapter', '# Timed\n');
        check(delays.indexOf(250) !== -1 && delays.indexOf(1500) !== -1,
            'emergency and durable debounce delays were not scheduled');
        timerSession.dispose();
        localStorage.removeItem(BookRecovery.key(timerId));
        results.push('text edits schedule the 250 ms emergency and 1,500 ms durable debounces');
        const visibility = new EventTarget();
        visibility.visibilityState = 'hidden';
        const session = ProsePersistence.create({ db: opened.db, bookId: id, now: clock(10),
            visibilityEvents: visibility, BroadcastChannel: null });
        await session.open();
        session.putText('one.md', 'chapter', '# One\n\nSaved together.\n');
        session.putText('two.md', 'chapter', '# Two\n\nSaved together.\n');
        visibility.dispatchEvent(new Event('visibilitychange'));
        const buffered = JSON.parse(localStorage.getItem(BookRecovery.key(id)));
        check(buffered.files.length === 2 && buffered.baseRevision === 0, 'all dirty text was not buffered');
        await session.save();
        let loaded = await Store.loadBook(opened.db, id);
        check(loaded.book.revision === 1 && loaded.files.find(function (file) { return file.path === 'two.md'; }),
            'multi-file autosave did not commit one revision');
        check(localStorage.getItem(BookRecovery.key(id)) === null, 'durable save did not clear emergency text');
        results.push('all dirty text commits atomically and clears only after durability');

        session.putText('one.md', 'chapter', '# One\n\nFirst in flight.\n');
        const first = session.save();
        session.putText('one.md', 'chapter', '# One\n\nTyped during save.\n');
        await first;
        check(session.state().dirtyPaths[0] === 'one.md', 'old completion cleared a newer edit');
        await session.save();
        loaded = await Store.loadBook(opened.db, id);
        check(loaded.files.find(function (file) { return file.path === 'one.md'; }).text.indexOf('Typed during') !== -1,
            'newer edit did not survive the in-flight save');
        results.push('generation token preserves edits made during an in-flight save');

        await session.putBinary({ path: 'research/map.bin', role: 'research', kind: 'binary',
            blob: new Blob(['map']), fingerprint: 'sha256:map' });
        loaded = await Store.loadBook(opened.db, id);
        check(loaded.files.some(function (file) { return file.path === 'research/map.bin'; }),
            'binary research did not commit immediately');
        results.push('binary research bypasses localStorage and commits immediately');

        session.putText('one.md', 'chapter', '');
        await session.save();
        loaded = await Store.loadBook(opened.db, id);
        check(loaded.files.find(function (file) { return file.path === 'one.md'; }).text === '',
            'an empty text file was treated as absence');
        await expectCode(function () { return Store.applyBookChange(opened.db, { bookId: id,
            expectedRevision: loaded.book.revision, now: loaded.book.updatedAt + 1, putFiles: [],
            removePaths: ['one.md', 'two.md'] }); }, 'book-last-chapter');
        results.push('empty chapter content persists and the last durable chapter cannot be removed');

        const pending = { id: 'persistence-intent', bookId: id, state: 'prepared',
            baseRevision: loaded.book.revision, createdAt: loaded.book.updatedAt + 2,
            changes: [{ path: 'book.txt', before: loaded.files.find(function (file) { return file.path === 'book.txt'; }),
                after: text(id, 'book.txt', 'index', 'Title: Test Book\nAuthor: Writer\nLanguage: en\n\ntwo.md\n',
                    loaded.book.revision + 1, loaded.book.updatedAt + 2) }] };
        await Store.prepareIntent(opened.db, pending);
        const paused = ProsePersistence.create({ db: opened.db, bookId: id, now: clock(100), BroadcastChannel: null });
        await paused.open();
        paused.putText('two.md', 'chapter', '# Two\n\nWhile intent waits.\n');
        await paused.save();
        check(paused.state().status === 'pending-intent' &&
            localStorage.getItem(BookRecovery.key(id)) !== null, 'pending intent did not pause autosave and retain text');
        paused.dispose();
        await Store.resolveIntent(opened.db, pending.id, 'cancel', loaded.book.updatedAt + 3);
        localStorage.removeItem(BookRecovery.key(id));
        results.push('pending intent pauses ordinary autosave while emergency text remains available');

        const storageFailure = {
            old: 'preserved',
            getItem: function () { return this.old; },
            setItem: function () { throw new DOMException('full', 'QuotaExceededError'); },
            removeItem: function () {}
        };
        const fallback = ProsePersistence.create({ db: opened.db, bookId: id, storage: storageFailure,
            now: clock(200), BroadcastChannel: null });
        await fallback.open();
        fallback.putText('two.md', 'chapter', '# Two\n\nFallback durable.\n');
        fallback.flushEmergency();
        await fallback.save();
        check(storageFailure.old === 'preserved', 'failed emergency write replaced the older recovery value');
        loaded = await Store.loadBook(opened.db, id);
        check(loaded.files.find(function (file) { return file.path === 'two.md'; }).text.indexOf('Fallback') !== -1,
            'emergency failure did not fall through to durable storage');
        fallback.dispose();
        results.push('localStorage refusal preserves its old value and triggers durable persistence');

        const conflictId = 'buffer-conflict-book';
        await Store.createBook(opened.db, { book: book(conflictId, 0, 1), files: initialFiles(conflictId) });
        const conflictSession = ProsePersistence.create({ db: opened.db, bookId: conflictId,
            now: clock(250), BroadcastChannel: null });
        await conflictSession.open();
        conflictSession.putText('one.md', 'chapter', '# One\n\nMust remain buffered.\n');
        conflictSession.flushEmergency();
        await Store.applyBookChange(opened.db, { bookId: conflictId, expectedRevision: 0, now: 2,
            putFiles: [text(conflictId, 'book.txt', 'index',
                'Title: Changed elsewhere\nAuthor: Writer\nLanguage: en\n\none.md\n', 0, 1)], removePaths: [] });
        await expectCode(function () { return conflictSession.save(); }, 'book-revision-conflict');
        check(localStorage.getItem(BookRecovery.key(conflictId)) !== null,
            'failed durable transaction cleared the emergency record');
        conflictSession.dispose();
        results.push('failed durable save retains the emergency buffer');

        const deletion = ProsePersistence.create({ db: opened.db, bookId: id, now: clock(300), BroadcastChannel: null });
        await deletion.open();
        await Store.putTarget(opened.db, { bookId: id, words: 1000 });
        loaded = await Store.loadBook(opened.db, id);
        await Store.createBookVersion(opened.db, { id: 'delete-version', bookId: id, takenAt: 301,
            revision: loaded.book.revision });
        await Store.addHandoff(opened.db, { id: 'delete-handoff', bookId: id, createdAt: 302,
            sourceRevision: loaded.book.revision, fileName: 'delete.epub', fingerprint: 'sha256:delete' });
        await deletion.softDelete();
        check(deletion.retention().status === 'recoverable', 'soft-deleted book is not recoverable');
        let deletedCode = null;
        try { deletion.putText('one.md', 'chapter', '# Changed while deleted\n'); }
        catch (problem) { deletedCode = problem && problem.code; }
        check(deletedCode === 'book-deleted', 'soft-deleted book remained editable before restore');
        await deletion.restoreDeleted();
        await deletion.softDelete();
        await expectCode(function () { return deletion.deleteForever('wrong-book'); }, 'delete-confirmation-invalid');
        await deletion.deleteForever(id);
        check((await Store.loadBook(opened.db, id)) === null, 'explicit permanent deletion retained the book');
        check(!(await Store.loadTargets(opened.db)).some(function (record) { return record.bookId === id; }) &&
            !(await Store.loadHandoffs(opened.db)).some(function (record) { return record.bookId === id; }) &&
            (await Store.loadBookVersions(opened.db, id)).length === 0,
        'explicit permanent deletion retained owned local records');
        results.push('soft delete restores, never expires automatically, and permanent delete requires exact confirmation');

        const guardedId = 'guarded-delete-book';
        await Store.createBook(opened.db, { book: book(guardedId, 0, 1), files: initialFiles(guardedId) });
        const removalFailure = { getItem: function () { return null; }, setItem: function () {},
            removeItem: function () { throw new DOMException('denied', 'SecurityError'); } };
        const guardedDelete = ProsePersistence.create({ db: opened.db, bookId: guardedId, storage: removalFailure,
            now: clock(350), BroadcastChannel: null });
        await guardedDelete.open();
        await guardedDelete.softDelete();
        await expectCode(function () { return guardedDelete.deleteForever(guardedId); }, 'emergency-unavailable');
        check((await Store.loadBook(opened.db, guardedId)) !== null,
            'permanent deletion proceeded without clearing emergency storage');
        guardedDelete.dispose();
        results.push('permanent deletion stops when emergency storage cannot be cleared');

        const blockedId = 'blocked-recovery-book';
        await Store.createBook(opened.db, { book: book(blockedId, 0, 1), files: initialFiles(blockedId) });
        const unavailableStorage = { getItem: function () { return null; },
            setItem: function () { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: function () {} };
        const blockedSession = ProsePersistence.create({ db: opened.db, bookId: blockedId,
            storage: unavailableStorage, now: clock(400), BroadcastChannel: null });
        await blockedSession.open();
        session.dispose();
        deletion.dispose();
        opened.db.close();
        blockedSession.putText('one.md', 'chapter', '# One\n\nCopy this text.\n');
        blockedSession.flushEmergency();
        await expectCode(function () { return blockedSession.save(); }, 'storage-closed');
        check(blockedSession.state().status === 'recovery-blocked',
            'failure of both emergency and durable storage did not become blocking');
        blockedSession.dispose();
        results.push('combined emergency and durable failure becomes a blocking recovery state');
        return results;
    }

    async function seedCrash(name) {
        await deleteDatabase(name);
        localStorage.clear();
        const opened = await Store.openBooks(indexedDB, { name: name });
        const id = 'crash-book';
        await Store.createBook(opened.db, { book: book(id, 0, 1), files: initialFiles(id) });
        const session = ProsePersistence.create({ db: opened.db, bookId: id, now: clock(10), BroadcastChannel: null });
        await session.open();
        session.putText('one.md', 'chapter', '# One\n\nRecovered one.\n');
        session.putText('two.md', 'chapter', '# Two\n\nRecovered two.\n');
        dispatchEvent(new Event('pagehide'));
        check(localStorage.getItem(BookRecovery.key(id)) !== null, 'pagehide did not synchronously buffer dirty text');
        return true;
    }

    async function recoverCrash(name) {
        const opened = await Store.openBooks(indexedDB, { name: name });
        const id = 'crash-book';
        const session = ProsePersistence.create({ db: opened.db, bookId: id, now: clock(100), BroadcastChannel: null });
        const state = await session.open();
        const loaded = await Store.loadBook(opened.db, id);
        const answer = { status: state.status, revision: loaded.book.revision,
            one: loaded.files.find(function (file) { return file.path === 'one.md'; }).text,
            two: loaded.files.find(function (file) { return file.path === 'two.md'; }).text,
            bufferPresent: localStorage.getItem(BookRecovery.key(id)) !== null };
        session.dispose();
        opened.db.close();
        return answer;
    }

    root.StoreBrowserTests = {
        freshAndRecovery: freshAndRecovery,
        race: race,
        seedRace: seedRace,
        holdV2: holdV2,
        closeHeld: closeHeld,
        openResult: openResult,
        holdStoreConnection: holdStoreConnection,
        upgradeRaw: upgradeRaw,
        versionChangeState: versionChangeState,
        quota: quota,
        persistence: persistence,
        seedCrash: seedCrash,
        recoverCrash: recoverCrash
    };
})(window);
