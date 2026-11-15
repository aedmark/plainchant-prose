(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./store-schema.js'));
    else root.Store = factory(root.StoreSchema);
})(typeof self !== 'undefined' ? self : this, function (Schema) {
    'use strict';

    const DB_NAME = 'plainchant_prose';
    const DB_VERSION = Schema.DB_VERSION;
    const SCRIPTS = 'scripts';
    const META = 'meta';
    const VERSIONS = 'versions';
    const FILES = 'files';
    const ASSETS = 'assets';
    const BY_SCRIPT = 'byScript';
    const BOOKS = Schema.STORE_NAMES.books;
    const BOOK_FILES = Schema.STORE_NAMES.files;
    const BOOK_UI = Schema.STORE_NAMES.ui;
    const BOOK_VERSIONS = Schema.STORE_NAMES.versions;
    const BOOK_VERSION_FILES = Schema.STORE_NAMES.versionFiles;
    const BOOK_INTENTS = Schema.STORE_NAMES.intents;
    const TARGETS = Schema.STORE_NAMES.targets;
    const FOLDER_LINKS = Schema.STORE_NAMES.links;
    const HANDOFFS = Schema.STORE_NAMES.handoffs;
    const BY_BOOK = 'byBook';
    const BY_BOOK_TAKEN = 'byBookTaken';
    const BY_VERSION = 'byVersion';
    const BY_VERSION_PATH = 'byVersionPath';
    const BY_BOOK_VERSION = 'byBookVersion';
    const BY_BOOK_STATE = 'byBookState';
    const BY_BOOK_CREATED = 'byBookCreated';
    const transactionProblems = new WeakMap();
    const recoveryDatabases = new WeakSet();
    const assetKey = (scriptId, path) => scriptId + '\u0000' + path;
    const ofScript = (id) => IDBKeyRange.bound([id, -Infinity], [id, Infinity]);

    const isRecord = (s) => !!s && typeof s === 'object' && typeof s.id === 'string' && s.id !== '' && typeof s.content === 'string';

    function diff(before, after) {
        const put = [];
        const remove = [];
        Object.keys(after).forEach((id) => { if (after[id] !== before[id]) put.push(after[id]); });
        Object.keys(before).forEach((id) => { if (!Object.prototype.hasOwnProperty.call(after, id)) remove.push(id); });
        return { put: put, remove: remove };
    }

    function guardSave(existing, record, freshId) {
        if (!existing || !existing.deletedAt) return record;
        const moved = Object.assign({}, record, { id: freshId });
        delete moved.deletedAt;
        return moved;
    }

    function reconcile(scripts, entries, makeId) {
        const next = Object.assign({}, scripts);
        const restored = [];
        let currentId = null;
        let newest = -Infinity;
        (Array.isArray(entries) ? entries : []).forEach((e) => {
            if (!isRecord(e) || typeof e.updatedAt !== 'number') return;
            const have = next[e.id];
            if (have && !have.deletedAt && ((have.updatedAt || 0) >= e.updatedAt || have.content === e.content)) return;
            const base = have && !have.deletedAt ? have : {};
            const record = guardSave(have, Object.assign({}, base, {
                id: e.id, title: typeof e.title === 'string' ? e.title : (base.title || ''), content: e.content, updatedAt: e.updatedAt
            }), have && have.deletedAt ? makeId() : e.id);
            next[record.id] = record;
            restored.push(record);
            if (e.updatedAt > newest) { newest = e.updatedAt; currentId = record.id; }
        });
        return { scripts: next, restored: restored, currentId: currentId };
    }

    const promised = (request) => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    const finished = (tx) => new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        // Request errors bubble through the transaction before the abort has populated tx.error.
        // Wait for onabort so callers retain the specific IndexedDB failure classification.
        tx.onerror = () => {};
        tx.onabort = () => reject(transactionProblems.get(tx) || tx.error || storageProblem('storage-aborted',
            'The write was abandoned.'));
    });

    function storageProblem(code, message) {
        const problem = new Error(message);
        problem.code = code;
        return problem;
    }

    function abortTransaction(tx, code, message) {
        transactionProblems.set(tx, storageProblem(code, message));
        try { tx.abort(); } catch (problem) {
        }
    }

    function createStore(db, name, options, indexes) {
        if (db.objectStoreNames.contains(name)) return null;
        const store = db.createObjectStore(name, options);
        (indexes || []).forEach(function (index) {
            store.createIndex(index[0], index[1], index[2]);
        });
        return store;
    }

    function installSchema(request, oldVersion, options) {
        const db = request.result;
        createStore(db, SCRIPTS, { keyPath: 'id' });
        createStore(db, META, { keyPath: 'key' });
        createStore(db, VERSIONS, { keyPath: 'id' }, [[BY_SCRIPT, ['scriptId', 'takenAt']]]);
        createStore(db, FILES, { keyPath: 'scriptId' });
        createStore(db, ASSETS, { keyPath: 'key' }, [[BY_SCRIPT, 'scriptId']]);

        createStore(db, BOOKS, { keyPath: 'id' });
        createStore(db, BOOK_FILES, { keyPath: ['bookId', 'path'] }, [
            [BY_BOOK, 'bookId'], ['byBookRole', ['bookId', 'role']]
        ]);
        createStore(db, BOOK_UI, { keyPath: 'bookId' });
        createStore(db, BOOK_VERSIONS, { keyPath: 'id' }, [[BY_BOOK_TAKEN, ['bookId', 'takenAt']]]);
        createStore(db, BOOK_VERSION_FILES, { keyPath: ['versionId', 'path'] }, [
            [BY_VERSION, 'versionId'], [BY_VERSION_PATH, ['versionId', 'path']],
            [BY_BOOK_VERSION, ['bookId', 'versionId']]
        ]);
        createStore(db, BOOK_INTENTS, { keyPath: 'id' }, [
            [BY_BOOK, 'bookId'], [BY_BOOK_STATE, ['bookId', 'state']]
        ]);
        createStore(db, TARGETS, { keyPath: 'bookId' });
        createStore(db, FOLDER_LINKS, { keyPath: 'bookId' });
        createStore(db, HANDOFFS, { keyPath: 'id' }, [[BY_BOOK_CREATED, ['bookId', 'createdAt']]]);
        if (oldVersion === 2) {
            request.transaction.objectStore(META).put({ key: 'prose.legacyV2Present', value: true });
        }
        if (options && options.failUpgrade) abortTransaction(request.transaction, 'storage-upgrade-test-abort',
            'The schema upgrade was deliberately aborted.');
    }

    function connect(factory, options) {
        const settings = options || {};
        const name = typeof settings.name === 'string' && settings.name ? settings.name : DB_NAME;
        return new Promise((resolve, reject) => {
            if (!factory || typeof factory.open !== 'function') {
                reject(storageProblem('storage-unavailable', 'IndexedDB is not available.'));
                return;
            }
            let request;
            let settled = false;
            try { request = factory.open(name, DB_VERSION); } catch (problem) { reject(problem); return; }
            request.onupgradeneeded = (event) => installSchema(request, event.oldVersion, settings);
            request.onsuccess = () => {
                const db = request.result;
                if (settled) { db.close(); return; }
                settled = true;
                db.onversionchange = () => {
                    db.close();
                    if (typeof settings.onVersionChange === 'function') settings.onVersionChange();
                };
                resolve(db);
            };
            request.onerror = () => {
                if (settled) return;
                settled = true;
                reject(settings.failUpgrade
                    ? storageProblem('storage-upgrade-test-abort', 'The schema upgrade was deliberately aborted.')
                    : (request.error || storageProblem('storage-failed', 'IndexedDB could not be opened.')));
            };
            request.onblocked = () => {
                if (settled) return;
                settled = true;
                reject(storageProblem('storage-blocked', 'IndexedDB is blocked by another tab.'));
            };
        });
    }

    function open(factory) {
        return connect(factory, {});
    }

    function loadAll(db) {
        const tx = db.transaction([SCRIPTS, META], 'readonly');
        const scripts = promised(tx.objectStore(SCRIPTS).getAll());
        const meta = promised(tx.objectStore(META).getAll());
        return Promise.all([scripts, meta]).then(([list, pairs]) => {
            const out = { scripts: {}, meta: {} };
            list.forEach((s) => { out.scripts[s.id] = s; });
            pairs.forEach((p) => { out.meta[p.key] = p.value; });
            return out;
        });
    }

    function putMeta(store, meta) {
        Object.keys(meta || {}).forEach((key) => {
            if (meta[key] === null || meta[key] === undefined) store.delete(key);
            else store.put({ key: key, value: meta[key] });
        });
    }

    function dropVersionsOf(versions, id) {
        const keys = versions.index(BY_SCRIPT).getAllKeys(ofScript(id));
        keys.onsuccess = () => keys.result.forEach((key) => versions.delete(key));
    }

    function dropAssetsOf(assets, scriptId) {
        const keys = assets.index(BY_SCRIPT).getAllKeys(IDBKeyRange.only(scriptId));
        keys.onsuccess = () => keys.result.forEach((key) => assets.delete(key));
    }

    function putAssets(db, scriptId, files) {
        const tx = db.transaction([ASSETS], 'readwrite');
        const store = tx.objectStore(ASSETS);
        const keys = store.index(BY_SCRIPT).getAllKeys(IDBKeyRange.only(scriptId));
        keys.onsuccess = () => {
            keys.result.forEach((key) => store.delete(key));
            Object.keys(files || {}).forEach((path) => {
                store.put({ key: assetKey(scriptId, path), scriptId: scriptId, path: path, blob: files[path] });
            });
        };
        return finished(tx);
    }

    function putAsset(db, scriptId, path, blob) {
        const tx = db.transaction([ASSETS], 'readwrite');
        tx.objectStore(ASSETS).put({ key: assetKey(scriptId, path), scriptId: scriptId, path: path, blob: blob });
        return finished(tx);
    }

    function deleteAsset(db, scriptId, path) {
        const tx = db.transaction([ASSETS], 'readwrite');
        tx.objectStore(ASSETS).delete(assetKey(scriptId, path));
        return finished(tx);
    }

    function loadAssets(db, scriptId) {
        const tx = db.transaction([ASSETS], 'readonly');
        return promised(tx.objectStore(ASSETS).index(BY_SCRIPT).getAll(IDBKeyRange.only(scriptId))).then((list) => {
            const out = {};
            list.forEach((a) => { out[a.path] = a.blob; });
            return out;
        });
    }

    function copyAssets(db, fromId, toId) {
        return loadAssets(db, fromId).then((files) => (Object.keys(files).length ? putAssets(db, toId, files) : null));
    }

    function keepVersion(versions, version, rules, now) {
        if (version) versions.put(version);
        const all = versions.index(BY_SCRIPT).getAll(ofScript(version.scriptId));
        all.onsuccess = () => rules.prune(all.result, now).forEach((id) => versions.delete(id));
    }

    function write(db, change) {
        const removing = (change.remove || []).length > 0;
        const tx = db.transaction(removing ? [SCRIPTS, META, VERSIONS, FILES, ASSETS] : [SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        (change.remove || []).forEach((id) => {
            scripts.delete(id);
            dropVersionsOf(tx.objectStore(VERSIONS), id);
            tx.objectStore(FILES).delete(id);
            dropAssetsOf(tx.objectStore(ASSETS), id);
        });
        (change.put || []).forEach((s) => scripts.put(s));
        putMeta(tx.objectStore(META), change.meta);
        return finished(tx);
    }

    function saveScript(db, record, freshId, versions) {
        const tx = db.transaction(versions ? [SCRIPTS, META, VERSIONS] : [SCRIPTS, META], 'readwrite');
        const scripts = tx.objectStore(SCRIPTS);
        let written = record;
        let deleted = null;
        const read = scripts.get(record.id);
        read.onsuccess = () => {
            const stored = read.result;
            written = guardSave(stored, record, freshId);
            if (written !== record) deleted = stored;
            scripts.put(written);
            putMeta(tx.objectStore(META), { currentScriptId: written.id });
            if (!versions || !stored) return;
            const store = tx.objectStore(VERSIONS);
            const last = store.index(BY_SCRIPT).openCursor(ofScript(stored.id), 'prev');
            last.onsuccess = () => {
                const latest = last.result ? last.result.value : null;
                if (versions.rules.due(stored, latest, versions.now, record)) {
                    keepVersion(store, versions.rules.make(stored, versions.makeId(), versions.now), versions.rules, versions.now);
                }
            };
        };
        return finished(tx).then(() => ({ record: written, deleted: deleted }));
    }

    function addVersion(db, version, rules, now) {
        const tx = db.transaction([VERSIONS], 'readwrite');
        keepVersion(tx.objectStore(VERSIONS), version, rules, now);
        return finished(tx);
    }

    function loadVersions(db, scriptId) {
        const tx = db.transaction([VERSIONS], 'readonly');
        return promised(tx.objectStore(VERSIONS).index(BY_SCRIPT).getAll(ofScript(scriptId))).then((list) => list.reverse());
    }

    function removeVersion(db, id) {
        const tx = db.transaction([VERSIONS], 'readwrite');
        tx.objectStore(VERSIONS).delete(id);
        return finished(tx);
    }

    function putLink(db, link) {
        const tx = db.transaction([FILES], 'readwrite');
        tx.objectStore(FILES).put(link);
        return finished(tx);
    }

    function loadLinks(db) {
        const tx = db.transaction([FILES], 'readonly');
        return promised(tx.objectStore(FILES).getAll()).then((list) => {
            const out = {};
            list.forEach((l) => { out[l.scriptId] = l; });
            return out;
        });
    }

    function removeLink(db, scriptId) {
        const tx = db.transaction([FILES], 'readwrite');
        tx.objectStore(FILES).delete(scriptId);
        return finished(tx);
    }

    function storageFailure(problem) {
        if (problem && typeof problem.code === 'string') return problem;
        const classified = Schema.classifyError(problem);
        return storageProblem(classified.code, classified.message);
    }

    function writable(db) {
        if (recoveryDatabases.has(db)) throw storageProblem('storage-recovery-read-only',
            'Stored records need recovery before this database can be changed.');
    }

    function requireValid(result) {
        if (!result.ok) throw storageProblem(result.code, result.message);
    }

    function completeWrite(tx, value) {
        return finished(tx).then(function () { return value; }).catch(function (problem) {
            throw storageFailure(problem);
        });
    }

    function filesByPath(files) {
        const out = new Map();
        files.forEach(function (file) { out.set(file.path, file); });
        return out;
    }

    function readBookSnapshot(tx, bookId, callback) {
        const bookRequest = tx.objectStore(BOOKS).get(bookId);
        const filesRequest = tx.objectStore(BOOK_FILES).index(BY_BOOK).getAll(IDBKeyRange.only(bookId));
        let pending = 2;
        function ready() {
            pending--;
            if (!pending) callback(bookRequest.result, filesRequest.result);
        }
        bookRequest.onsuccess = ready;
        filesRequest.onsuccess = ready;
    }

    function normalizedFile(file, bookId, revision, now) {
        return Object.assign({}, file, { bookId: bookId, revision: revision, updatedAt: now });
    }

    function rejectIn(tx, problem) {
        abortTransaction(tx, problem.code || 'storage-failed', problem.message || 'The storage operation failed.');
    }

    function createBook(db, input) {
        writable(db);
        const data = input || {};
        requireValid(Schema.validateSnapshot(data.book, data.files));
        if (data.ui !== undefined) requireValid(Schema.validateAuxiliary('book-ui', data.ui));
        if (data.ui && data.ui.bookId !== data.book.id) {
            throw storageProblem('book-ui-owner-mismatch', 'Book UI state belongs to another book.');
        }
        const names = data.ui === undefined ? [BOOKS, BOOK_FILES] : [BOOKS, BOOK_FILES, BOOK_UI];
        const tx = db.transaction(names, 'readwrite');
        tx.objectStore(BOOKS).add(data.book);
        const fileStore = tx.objectStore(BOOK_FILES);
        data.files.forEach(function (file) { fileStore.add(file); });
        if (data.ui !== undefined) tx.objectStore(BOOK_UI).put(data.ui);
        return completeWrite(tx, { book: data.book, files: data.files.slice() });
    }

    function loadBook(db, bookId) {
        const tx = db.transaction([BOOKS, BOOK_FILES, BOOK_UI], 'readonly');
        const book = promised(tx.objectStore(BOOKS).get(bookId));
        const files = promised(tx.objectStore(BOOK_FILES).index(BY_BOOK).getAll(IDBKeyRange.only(bookId)));
        const ui = promised(tx.objectStore(BOOK_UI).get(bookId));
        return Promise.all([book, files, ui]).then(function (result) {
            if (!result[0]) return null;
            return { book: result[0], files: result[1], ui: result[2] || null };
        }).catch(function (problem) { throw storageFailure(problem); });
    }

    function loadBooks(db) {
        const tx = db.transaction([BOOKS], 'readonly');
        return promised(tx.objectStore(BOOKS).getAll()).catch(function (problem) { throw storageFailure(problem); });
    }

    function applyBookChange(db, change) {
        writable(db);
        const plan = change || {};
        if (!Schema.validId(plan.bookId) || !Number.isSafeInteger(plan.expectedRevision) || plan.expectedRevision < 0 ||
            !Number.isSafeInteger(plan.now) || plan.now < 0 || !Array.isArray(plan.putFiles) ||
            !Array.isArray(plan.removePaths)) {
            throw storageProblem('book-change-invalid', 'A book change is incomplete or invalid.');
        }
        const paths = new Set();
        plan.removePaths.forEach(function (path) {
            if (!Schema.validPath(path) || paths.has(path)) throw storageProblem('book-change-path-invalid',
                'Book-change paths must be unique and valid.');
            paths.add(path);
        });
        plan.putFiles.forEach(function (file) {
            if (!file || !Schema.validPath(file.path) || paths.has(file.path)) {
                throw storageProblem('book-change-path-invalid', 'Book-change paths must be unique and valid.');
            }
            paths.add(file.path);
        });
        const patch = plan.bookPatch || {};
        if (Object.keys(patch).some(function (key) { return key !== 'title' && key !== 'deletedAt'; })) {
            throw storageProblem('book-change-patch-invalid', 'A book change contains an unsupported book field.');
        }
        const tx = db.transaction([BOOKS, BOOK_FILES], 'readwrite');
        let written;
        readBookSnapshot(tx, plan.bookId, function (book, currentFiles) {
            try {
                if (!book) throw storageProblem('book-missing', 'The book does not exist.');
                if (book.revision !== plan.expectedRevision) throw storageProblem('book-revision-conflict',
                    'The book changed before this transaction acquired its write lock.');
                if (plan.now < book.updatedAt) throw storageProblem('book-time-conflict',
                    'The change timestamp predates the stored book revision.');
                const revision = book.revision + 1;
                written = Object.assign({}, book, patch, { revision: revision, updatedAt: plan.now });
                const next = filesByPath(currentFiles);
                plan.removePaths.forEach(function (path) { next.delete(path); });
                plan.putFiles.forEach(function (file) {
                    next.set(file.path, normalizedFile(file, plan.bookId, revision, plan.now));
                });
                const nextFiles = Array.from(next.values());
                const hadChapter = currentFiles.some(function (file) { return file.role === 'chapter'; });
                if (hadChapter && !nextFiles.some(function (file) { return file.role === 'chapter'; })) {
                    throw storageProblem('book-last-chapter', 'The last durable chapter cannot be removed.');
                }
                requireValid(Schema.validateSnapshot(written, nextFiles));
                const store = tx.objectStore(BOOK_FILES);
                plan.removePaths.forEach(function (path) { store.delete([plan.bookId, path]); });
                plan.putFiles.forEach(function (file) { store.put(next.get(file.path)); });
                tx.objectStore(BOOKS).put(written);
            } catch (problem) { rejectIn(tx, problem); }
        });
        return completeWrite(tx).then(function () { return written; });
    }

    function deleteBookForever(db, bookId) {
        writable(db);
        if (!Schema.validId(bookId)) throw storageProblem('book-id-invalid', 'A book identifier is invalid.');
        const names = [BOOKS, BOOK_FILES, BOOK_UI, BOOK_VERSIONS, BOOK_VERSION_FILES, BOOK_INTENTS,
            TARGETS, FOLDER_LINKS, HANDOFFS];
        const tx = db.transaction(names, 'readwrite');
        const bookRequest = tx.objectStore(BOOKS).get(bookId);
        bookRequest.onsuccess = function () {
            if (!bookRequest.result) {
                rejectIn(tx, storageProblem('book-missing', 'The book does not exist.'));
                return;
            }
            function deleteIndexKeys(storeName, indexName, range) {
                const store = tx.objectStore(storeName);
                const request = store.index(indexName).getAllKeys(range);
                request.onsuccess = function () { request.result.forEach(function (key) { store.delete(key); }); };
            }
            deleteIndexKeys(BOOK_FILES, BY_BOOK, IDBKeyRange.only(bookId));
            deleteIndexKeys(BOOK_VERSIONS, BY_BOOK_TAKEN,
                IDBKeyRange.bound([bookId, -Infinity], [bookId, Infinity]));
            deleteIndexKeys(BOOK_VERSION_FILES, BY_BOOK_VERSION,
                IDBKeyRange.bound([bookId, ''], [bookId, '\uffff']));
            deleteIndexKeys(BOOK_INTENTS, BY_BOOK, IDBKeyRange.only(bookId));
            deleteIndexKeys(HANDOFFS, BY_BOOK_CREATED,
                IDBKeyRange.bound([bookId, -Infinity], [bookId, Infinity]));
            tx.objectStore(BOOK_UI).delete(bookId);
            tx.objectStore(TARGETS).delete(bookId);
            tx.objectStore(FOLDER_LINKS).delete(bookId);
            tx.objectStore(BOOKS).delete(bookId);
        };
        return completeWrite(tx);
    }

    function createBookVersion(db, record) {
        writable(db);
        requireValid(Schema.validateVersion(record));
        const tx = db.transaction([BOOKS, BOOK_FILES, BOOK_VERSIONS, BOOK_VERSION_FILES], 'readwrite');
        readBookSnapshot(tx, record.bookId, function (book, files) {
            try {
                if (!book) throw storageProblem('book-missing', 'The book does not exist.');
                if (book.revision !== record.revision) throw storageProblem('book-revision-conflict',
                    'The book changed before the version could be recorded.');
                requireValid(Schema.validateSnapshot(book, files));
                tx.objectStore(BOOK_VERSIONS).add(record);
                const snapshots = tx.objectStore(BOOK_VERSION_FILES);
                files.forEach(function (file) {
                    const copy = Object.assign({}, file, { versionId: record.id });
                    delete copy.revision;
                    delete copy.updatedAt;
                    requireValid(Schema.validateFile(copy, true));
                    snapshots.add(copy);
                });
            } catch (problem) { rejectIn(tx, problem); }
        });
        return completeWrite(tx, record);
    }

    function removeBookVersion(db, versionId) {
        writable(db);
        if (!Schema.validId(versionId)) throw storageProblem('version-id-invalid', 'A version identifier is invalid.');
        const tx = db.transaction([BOOK_VERSIONS, BOOK_VERSION_FILES], 'readwrite');
        const headers = tx.objectStore(BOOK_VERSIONS);
        const files = tx.objectStore(BOOK_VERSION_FILES);
        const read = headers.get(versionId);
        read.onsuccess = function () {
            if (!read.result) { rejectIn(tx, storageProblem('version-missing', 'The version does not exist.')); return; }
            const keys = files.index(BY_VERSION).getAllKeys(IDBKeyRange.only(versionId));
            keys.onsuccess = function () {
                keys.result.forEach(function (key) { files.delete(key); });
                headers.delete(versionId);
            };
        };
        return completeWrite(tx);
    }

    function loadBookVersions(db, bookId) {
        const tx = db.transaction([BOOK_VERSIONS], 'readonly');
        const range = IDBKeyRange.bound([bookId, -Infinity], [bookId, Infinity]);
        return promised(tx.objectStore(BOOK_VERSIONS).index(BY_BOOK_TAKEN).getAll(range)).then(function (records) {
            return records.reverse();
        }).catch(function (problem) { throw storageFailure(problem); });
    }

    function loadBookVersion(db, versionId) {
        const tx = db.transaction([BOOK_VERSIONS, BOOK_VERSION_FILES], 'readonly');
        const header = promised(tx.objectStore(BOOK_VERSIONS).get(versionId));
        const files = promised(tx.objectStore(BOOK_VERSION_FILES).index(BY_VERSION).getAll(IDBKeyRange.only(versionId)));
        return Promise.all([header, files]).then(function (result) {
            return result[0] ? { version: result[0], files: result[1] } : null;
        }).catch(function (problem) { throw storageFailure(problem); });
    }

    function prepareIntent(db, intent) {
        writable(db);
        requireValid(Schema.validateIntent(intent));
        if (intent.state !== 'prepared') throw storageProblem('intent-state-conflict',
            'A new intent must begin in the prepared state.');
        const tx = db.transaction([BOOKS, BOOK_FILES, BOOK_INTENTS], 'readwrite');
        readBookSnapshot(tx, intent.bookId, function (book, files) {
            try {
                if (!book) throw storageProblem('book-missing', 'The book does not exist.');
                if (book.revision !== intent.baseRevision) throw storageProblem('book-revision-conflict',
                    'The book changed before the intent was prepared.');
                const current = filesByPath(files);
                intent.changes.forEach(function (change) {
                    if (!Schema.sameFile(current.get(change.path) || null, change.before)) {
                        throw storageProblem('intent-content-conflict', 'An intent before-image does not match storage.');
                    }
                });
                tx.objectStore(BOOK_INTENTS).add(intent);
            } catch (problem) { rejectIn(tx, problem); }
        });
        return completeWrite(tx, intent);
    }

    function changeSnapshot(tx, intent, book, files, direction, now, removeIntent) {
        if (now < book.updatedAt) throw storageProblem('book-time-conflict',
            'The intent timestamp predates the stored book revision.');
        const current = filesByPath(files);
        const expectedKey = direction === 'forward' ? 'before' : 'after';
        const wantedKey = direction === 'forward' ? 'after' : 'before';
        intent.changes.forEach(function (change) {
            if (!Schema.sameFile(current.get(change.path) || null, change[expectedKey])) {
                throw storageProblem('intent-content-conflict', 'Stored content no longer matches the intent.');
            }
        });
        const revision = book.revision + 1;
        intent.changes.forEach(function (change) {
            const wanted = change[wantedKey];
            if (wanted === null) current.delete(change.path);
            else current.set(change.path, normalizedFile(wanted, book.id, revision, now));
        });
        const nextBook = Object.assign({}, book, { revision: revision, updatedAt: now });
        requireValid(Schema.validateSnapshot(nextBook, Array.from(current.values())));
        const store = tx.objectStore(BOOK_FILES);
        intent.changes.forEach(function (change) {
            const wanted = change[wantedKey];
            if (wanted === null) store.delete([book.id, change.path]);
            else store.put(current.get(change.path));
        });
        tx.objectStore(BOOKS).put(nextBook);
        if (removeIntent) tx.objectStore(BOOK_INTENTS).delete(intent.id);
        return nextBook;
    }

    function applyIntent(db, intentId, now) {
        writable(db);
        if (!Schema.validId(intentId) || !Number.isSafeInteger(now) || now < 0) {
            throw storageProblem('intent-resolution-invalid', 'Intent resolution input is invalid.');
        }
        const tx = db.transaction([BOOKS, BOOK_FILES, BOOK_INTENTS], 'readwrite');
        const read = tx.objectStore(BOOK_INTENTS).get(intentId);
        let written;
        read.onsuccess = function () {
            const intent = read.result;
            if (!intent) { rejectIn(tx, storageProblem('intent-missing', 'The intent does not exist.')); return; }
            readBookSnapshot(tx, intent.bookId, function (book, files) {
                try {
                    requireValid(Schema.validateIntent(intent));
                    if (intent.state !== 'prepared') throw storageProblem('intent-state-conflict',
                        'Only a prepared intent can be applied.');
                    if (!book || book.revision !== intent.baseRevision) throw storageProblem('book-revision-conflict',
                        'The book changed before the intent was applied.');
                    written = changeSnapshot(tx, intent, book, files, 'forward', now, false);
                    tx.objectStore(BOOK_INTENTS).put(Object.assign({}, intent, {
                        state: 'applied', appliedRevision: written.revision
                    }));
                } catch (problem) { rejectIn(tx, problem); }
            });
        };
        return completeWrite(tx).then(function () { return written; });
    }

    function resolveIntent(db, intentId, choice, now) {
        if (choice === 'complete') return applyIntent(db, intentId, now);
        writable(db);
        if (!Schema.validId(intentId) || !['cancel', 'finalize', 'rollback'].includes(choice) ||
            !Number.isSafeInteger(now) || now < 0) {
            throw storageProblem('intent-resolution-invalid', 'Intent resolution input is invalid.');
        }
        const tx = db.transaction([BOOKS, BOOK_FILES, BOOK_INTENTS], 'readwrite');
        const read = tx.objectStore(BOOK_INTENTS).get(intentId);
        let written = null;
        read.onsuccess = function () {
            const intent = read.result;
            if (!intent) { rejectIn(tx, storageProblem('intent-missing', 'The intent does not exist.')); return; }
            readBookSnapshot(tx, intent.bookId, function (book, files) {
                try {
                    requireValid(Schema.validateIntent(intent));
                    const expectedState = choice === 'cancel' ? 'prepared' : 'applied';
                    if (intent.state !== expectedState) throw storageProblem('intent-state-conflict',
                        'The requested resolution does not match the intent state.');
                    const expectedRevision = choice === 'cancel' ? intent.baseRevision : intent.appliedRevision;
                    if (!book || book.revision !== expectedRevision) throw storageProblem('book-revision-conflict',
                        'The book changed after this intent state was recorded.');
                    if (choice === 'rollback') {
                        written = changeSnapshot(tx, intent, book, files, 'backward', now, true);
                        return;
                    }
                    const current = filesByPath(files);
                    const image = choice === 'cancel' ? 'before' : 'after';
                    intent.changes.forEach(function (change) {
                        if (!Schema.sameFile(current.get(change.path) || null, change[image])) {
                            throw storageProblem('intent-content-conflict', 'Stored content no longer matches the intent.');
                        }
                    });
                    tx.objectStore(BOOK_INTENTS).delete(intent.id);
                } catch (problem) { rejectIn(tx, problem); }
            });
        };
        return completeWrite(tx).then(function () { return written; });
    }

    function loadBookIntents(db, bookId) {
        const tx = db.transaction([BOOK_INTENTS], 'readonly');
        return promised(tx.objectStore(BOOK_INTENTS).index(BY_BOOK).getAll(IDBKeyRange.only(bookId)))
            .catch(function (problem) { throw storageFailure(problem); });
    }

    function putAuxiliary(db, storeName, kind, record, add) {
        writable(db);
        requireValid(Schema.validateAuxiliary(kind, record));
        const tx = db.transaction([BOOKS, storeName], 'readwrite');
        const request = tx.objectStore(BOOKS).get(record.bookId);
        request.onsuccess = function () {
            try {
                if (!request.result) throw storageProblem(kind + '-orphan',
                    'The auxiliary record belongs to a missing book.');
                tx.objectStore(storeName)[add ? 'add' : 'put'](record);
            } catch (problem) { rejectIn(tx, problem); }
        };
        return completeWrite(tx, record);
    }

    function getStoreRecords(db, storeName, bookId) {
        const tx = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const request = bookId === undefined ? store.getAll() : store.get(bookId);
        return promised(request).catch(function (problem) { throw storageFailure(problem); });
    }

    function inspectBooks(db) {
        const names = [BOOKS, BOOK_FILES, BOOK_UI, BOOK_VERSIONS, BOOK_VERSION_FILES, BOOK_INTENTS,
            TARGETS, FOLDER_LINKS, HANDOFFS, META];
        const expected = [SCRIPTS, META, VERSIONS, FILES, ASSETS].concat(names.slice(0, -1));
        const present = [];
        for (let index = 0; index < db.objectStoreNames.length; index++) present.push(db.objectStoreNames[index]);
        const topology = [];
        expected.forEach(function (name) {
            if (present.indexOf(name) === -1) topology.push({ code: 'store-missing', store: name, key: null });
        });
        present.forEach(function (name) {
            if (expected.indexOf(name) === -1) topology.push({ code: 'store-unknown', store: name, key: null });
        });
        if (topology.length) {
            recoveryDatabases.add(db);
            return Promise.resolve({ status: 'recovery-required', writable: false, problems: topology, warnings: [],
                legacyV2Present: false, bookCount: 0 });
        }
        let tx;
        try { tx = db.transaction(names, 'readonly'); } catch (problem) { return Promise.reject(storageFailure(problem)); }
        const requests = names.map(function (name) { return promised(tx.objectStore(name).getAll()); });
        return Promise.all(requests).then(function (lists) {
            const problems = [];
            const warnings = [];
            const books = new Map();
            const versions = new Map();
            const versionFiles = new Map();
            function problem(code, storeName, key) { problems.push({ code: code, store: storeName, key: key }); }
            lists[0].forEach(function (book) {
                const result = Schema.validateBook(book);
                if (!result.ok || books.has(book && book.id)) problem(result.ok ? 'book-id-duplicate' : result.code,
                    BOOKS, book && book.id);
                else books.set(book.id, book);
            });
            const grouped = new Map();
            lists[1].forEach(function (file) {
                const result = Schema.validateFile(file, false);
                if (!result.ok || !books.has(file && file.bookId)) problem(result.ok ? 'book-file-orphan' : result.code,
                    BOOK_FILES, file && file.path);
                else {
                    if (!grouped.has(file.bookId)) grouped.set(file.bookId, []);
                    grouped.get(file.bookId).push(file);
                }
            });
            books.forEach(function (book, id) {
                const result = Schema.validateSnapshot(book, grouped.get(id) || []);
                if (!result.ok) problem(result.code, BOOKS, id);
            });
            lists[3].forEach(function (version) {
                const result = Schema.validateVersion(version);
                if (!result.ok || !books.has(version && version.bookId) || versions.has(version && version.id)) {
                    problem(!result.ok ? result.code : 'version-orphan', BOOK_VERSIONS, version && version.id);
                } else versions.set(version.id, version);
            });
            lists[4].forEach(function (file) {
                const result = Schema.validateFile(file, true);
                if (!result.ok || !versions.has(file && file.versionId) ||
                    (versions.has(file && file.versionId) && versions.get(file.versionId).bookId !== file.bookId)) {
                    problem(!result.ok ? result.code : 'version-file-orphan', BOOK_VERSION_FILES, file && file.path);
                } else {
                    if (!versionFiles.has(file.versionId)) versionFiles.set(file.versionId, []);
                    versionFiles.get(file.versionId).push(file);
                }
            });
            versions.forEach(function (version, id) {
                const result = Schema.validateVersionSnapshot(version, versionFiles.get(id) || []);
                if (!result.ok) problem(result.code, BOOK_VERSIONS, id);
            });
            lists[5].forEach(function (intent) {
                const result = Schema.validateIntent(intent);
                if (!result.ok || !books.has(intent && intent.bookId)) problem(!result.ok ? result.code : 'intent-orphan',
                    BOOK_INTENTS, intent && intent.id);
                else warnings.push({ code: 'intent-' + intent.state, intentId: intent.id, bookId: intent.bookId });
            });
            [[2, 'book-ui', BOOK_UI], [6, 'target', TARGETS], [7, 'folder-link', FOLDER_LINKS],
                [8, 'handoff', HANDOFFS]].forEach(function (entry) {
                lists[entry[0]].forEach(function (record) {
                    const result = Schema.validateAuxiliary(entry[1], record);
                    if (!result.ok || !books.has(record && record.bookId)) problem(!result.ok ? result.code :
                        entry[1] + '-orphan', entry[2], record && (record.id || record.bookId));
                });
            });
            if (problems.length) recoveryDatabases.add(db);
            const legacy = lists[9].some(function (item) {
                return item && item.key === 'prose.legacyV2Present' && item.value === true;
            });
            return {
                status: problems.length ? 'recovery-required' : 'ready',
                writable: problems.length === 0,
                problems: problems,
                warnings: warnings,
                legacyV2Present: legacy,
                bookCount: books.size
            };
        }).catch(function (problem) { throw storageFailure(problem); });
    }

    function openBooks(factory, options) {
        return connect(factory, options || {}).then(function (db) {
            return inspectBooks(db).then(function (inspection) {
                return Object.assign({ db: db }, inspection);
            }, function (problem) {
                db.close();
                throw problem;
            });
        }).catch(function (problem) {
            const classified = Schema.classifyError(problem);
            const statuses = {
                'storage-blocked': 'blocked',
                'storage-newer-schema': 'newer-schema',
                'storage-upgrade-test-abort': 'upgrade-failed',
                'storage-unavailable': 'unavailable'
            };
            return { status: statuses[classified.code] || 'failed', writable: false, code: classified.code,
                message: classified.message, problems: [], warnings: [] };
        });
    }

    return {
        DB_NAME: DB_NAME, DB_VERSION: DB_VERSION, STORE_NAMES: Schema.STORE_NAMES,
        diff: diff, guardSave: guardSave, reconcile: reconcile,
        open: open, loadAll: loadAll, write: write, saveScript: saveScript,
        addVersion: addVersion, loadVersions: loadVersions, removeVersion: removeVersion,
        putAssets: putAssets, putAsset: putAsset, deleteAsset: deleteAsset, loadAssets: loadAssets, copyAssets: copyAssets,
        putLink: putLink, loadLinks: loadLinks, removeLink: removeLink,
        connect: connect, openBooks: openBooks, inspectBooks: inspectBooks,
        createBook: createBook, loadBook: loadBook, loadBooks: loadBooks, applyBookChange: applyBookChange,
        deleteBookForever: deleteBookForever,
        createBookVersion: createBookVersion, loadBookVersions: loadBookVersions,
        loadBookVersion: loadBookVersion, removeBookVersion: removeBookVersion,
        prepareIntent: prepareIntent, applyIntent: applyIntent, resolveIntent: resolveIntent,
        loadBookIntents: loadBookIntents,
        putBookUi: function (db, record) { return putAuxiliary(db, BOOK_UI, 'book-ui', record, false); },
        putTarget: function (db, record) { return putAuxiliary(db, TARGETS, 'target', record, false); },
        putFolderLink: function (db, record) { return putAuxiliary(db, FOLDER_LINKS, 'folder-link', record, false); },
        addHandoff: function (db, record) { return putAuxiliary(db, HANDOFFS, 'handoff', record, true); },
        loadBookUi: function (db, bookId) { return getStoreRecords(db, BOOK_UI, bookId); },
        loadTargets: function (db) { return getStoreRecords(db, TARGETS); },
        loadFolderLinks: function (db) { return getStoreRecords(db, FOLDER_LINKS); },
        loadHandoffs: function (db) { return getStoreRecords(db, HANDOFFS); },
        classifyError: Schema.classifyError
    };
});
