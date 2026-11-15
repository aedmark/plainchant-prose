/* Browser coordination for Prose folder synchronization (P1-06, D-022). Native access arrives in P1-07. */
(function (root, factory) {
    root.ProseBookSync = factory(root, root.FileSync, root.Store);
})(typeof self !== 'undefined' ? self : this, function (root, FileSync, Store) {
    'use strict';

    function problem(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function bytesOf(value) {
        if (value instanceof Uint8Array) return Promise.resolve(value);
        if (value instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(value));
        if (value && typeof value.arrayBuffer === 'function') {
            return value.arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
        }
        throw problem('sync-bytes-invalid', 'A folder entry does not contain readable bytes.');
    }

    function textBytes(value) { return new TextEncoder().encode(String(value == null ? '' : value)); }

    function hashBytes(bytes, cryptoApi) {
        if (!cryptoApi || !cryptoApi.subtle) return Promise.reject(problem('sync-crypto-unavailable',
            'SHA-256 is unavailable in this application context.'));
        return cryptoApi.subtle.digest('SHA-256', bytes).then(function (digest) {
            return 'sha256:' + Array.from(new Uint8Array(digest)).map(function (byte) {
                return byte.toString(16).padStart(2, '0');
            }).join('');
        });
    }

    function fingerprint(entry, cryptoApi) {
        if (!entry || !FileSync.validPath(entry.path) || !['text', 'binary'].includes(entry.kind)) {
            return Promise.reject(problem('sync-entry-invalid', 'A folder snapshot entry is invalid.'));
        }
        // P1-07 native scans hash bytes inside the confined Rust boundary. Reusing those validated marks avoids
        // reading every file into the webview merely to discover whether it changed.
        if (FileSync.validateEntry(entry) && entry.text === undefined && entry.bytes === undefined && !entry.blob) {
            return Promise.resolve(Object.freeze({ path: entry.path, kind: entry.kind,
                exact: entry.exact, canonical: entry.canonical }));
        }
        const exactBytes = entry.kind === 'text' ? textBytes(entry.text) : bytesOf(entry.bytes || entry.blob);
        return Promise.resolve(exactBytes).then(function (bytes) {
            const canonical = entry.kind === 'text' ? textBytes(FileSync.canonicalText(entry.text)) : bytes;
            return Promise.all([hashBytes(bytes, cryptoApi), hashBytes(canonical, cryptoApi)]);
        }).then(function (hashes) {
            return Object.freeze({ path: entry.path, kind: entry.kind, exact: hashes[0], canonical: hashes[1] });
        });
    }

    function snapshot(entries, cryptoApi) {
        const list = Array.isArray(entries) ? entries : [];
        if (list.length > 10000) return Promise.reject(problem('sync-too-many-files',
            'A book folder contains more than 10,000 files.'));
        return Promise.all(list.map(function (entry) { return fingerprint(entry, cryptoApi); })).then(function (items) {
            const seen = new Set();
            items.forEach(function (item) {
                if (seen.has(item.path)) throw problem('sync-path-duplicate', 'A folder snapshot repeats a path.');
                seen.add(item.path);
            });
            return Object.freeze(items.slice().sort(function (a, b) { return a.path.localeCompare(b.path); }));
        });
    }

    function localEntries(files) {
        return (files || []).map(function (file) {
            return file.kind === 'text'
                ? { path: file.path, kind: 'text', text: file.text }
                : { path: file.path, kind: 'binary', blob: file.blob };
        });
    }

    function dataByPath(entries) {
        const map = new Map();
        (entries || []).forEach(function (entry) { map.set(entry.path, entry); });
        return map;
    }

    function roleFor(path) {
        if (path === 'book.txt') return 'index';
        if (path.startsWith('research/')) return 'research';
        return 'chapter';
    }

    function storedFile(bookId, entry, cryptoApi) {
        if (entry.kind === 'text') return { bookId: bookId, path: entry.path, role: roleFor(entry.path),
            kind: 'text', text: entry.text };
        return fingerprint(entry, cryptoApi).then(function (mark) {
            const blob = entry.blob || new Blob([entry.bytes]);
            return { bookId: bookId, path: entry.path, role: 'research', kind: 'binary', blob: blob,
                fingerprint: mark.exact };
        });
    }

    function createRegistry() {
        const owners = new Map();
        return Object.freeze({
            claim: function (authorityId, bookId) {
                if (typeof authorityId !== 'string' || !authorityId) throw problem('folder-authority-missing',
                    'The native folder grant has no session identity.');
                const owner = owners.get(authorityId);
                if (owner && owner !== bookId) return Object.freeze({ ok: false, code: 'folder-already-linked', bookId: owner });
                owners.set(authorityId, bookId);
                return Object.freeze({ ok: true, code: 'folder-claimed' });
            },
            release: function (authorityId, bookId) {
                if (owners.get(authorityId) === bookId) owners.delete(authorityId);
            }
        });
    }

    const sharedRegistry = createRegistry();

    function create(options) {
        const settings = options || {};
        const db = settings.db;
        const bookId = settings.bookId;
        const adapter = settings.adapter;
        const cryptoApi = settings.crypto || root.crypto;
        const registry = settings.registry || sharedRegistry;
        const now = settings.now || Date.now;
        const makeId = settings.makeId || function () {
            return 'sync-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        };
        const hasEditorPending = settings.hasEditorPending || function () { return false; };
        let link = settings.link || null;
        let status = 'closed';
        let lastPlan = null;
        let claimed = false;

        function publicState() {
            return Object.freeze({ status: status, bookId: bookId, linked: Boolean(link), plan: lastPlan });
        }

        function requireBoundary() {
            if (!db || !bookId || !adapter || typeof adapter.scan !== 'function' ||
                typeof adapter.read !== 'function' || typeof adapter.writeAtomic !== 'function') {
                throw problem('sync-boundary-invalid', 'The folder synchronization boundary is incomplete.');
            }
            if (!adapter.authorityId) throw problem('folder-authority-missing',
                'A native dialog grant is required for this folder session.');
        }

        function inspectDetails() {
            requireBoundary();
            if (hasEditorPending()) {
                status = 'editor-pending';
                return Promise.resolve({ state: publicState(), book: null, diskEntries: [],
                    localSnapshot: [], diskSnapshot: [] });
            }
            return Promise.all([Store.loadBook(db, bookId), adapter.scan()]).then(function (values) {
                const local = values[0];
                const diskEntries = values[1];
                if (!local) throw problem('book-missing', 'The working copy does not exist.');
                return Promise.all([snapshot(localEntries(local.files), cryptoApi), snapshot(diskEntries, cryptoApi)])
                    .then(function (marks) {
                        const baseline = link && link.fingerprints && link.fingerprints.every(FileSync.validateEntry)
                            ? link.fingerprints : [];
                        lastPlan = FileSync.plan({ baseline: baseline, local: marks[0], disk: marks[1],
                            explicitDeletes: settings.explicitDeletes ? settings.explicitDeletes() : [] });
                        status = lastPlan.status;
                        return { state: publicState(), book: local, diskEntries: diskEntries,
                            localSnapshot: marks[0], diskSnapshot: marks[1] };
                    });
            });
        }

        function preflight(action) {
            let current = null;
            return adapter.read(action.path).then(function (entry) {
                current = entry;
                return entry ? fingerprint(entry, cryptoApi) : null;
            }).then(function (observed) {
                const check = FileSync.preflight(action.expectedExact, observed);
                if (!check.ok) throw problem(check.code, 'The folder changed before Prose could write ' + action.path + '.');
                return current;
            });
        }

        function writeAction(action, localData) {
            return preflight(action).then(function (previous) {
                const file = localData.get(action.path);
                if (!file) throw problem('sync-local-file-missing', 'The working-copy file disappeared before synchronization.');
                const payload = file.kind === 'text'
                    ? { path: file.path, kind: 'text', text: FileSync.diskText(file.text,
                        previous && previous.kind === 'text' ? previous.text : '') }
                    : { path: file.path, kind: 'binary', blob: file.blob };
                return adapter.writeAtomic(action.path, payload, action.expectedExact);
            });
        }

        function saveLink(fingerprints) {
            link = { bookId: bookId, displayName: String(adapter.displayName || 'Linked book folder').slice(0, 1000),
                platform: String(adapter.platform || 'desktop').slice(0, 100), fingerprints: fingerprints };
            return Store.putFolderLink(db, link);
        }

        function inspect() {
            return inspectDetails().then(function (result) { return result.state; });
        }

        function sync() {
            const pendingOperations = [];
            function rememberOperations(receipt) {
                if (receipt && typeof receipt.operationId === 'string') pendingOperations.push(receipt.operationId);
                if (receipt && Array.isArray(receipt.operationIds)) receipt.operationIds.forEach(function (id) {
                    if (typeof id === 'string') pendingOperations.push(id);
                });
                return receipt;
            }
            return inspectDetails().then(function (result) {
                if (!result.state.plan || result.state.plan.blocked || result.state.status === 'editor-pending') return result.state;
                const writes = result.state.plan.actions.filter(function (action) { return action.type === 'write'; });
                const loads = result.state.plan.actions.filter(function (action) { return action.type === 'load'; });
                const localData = dataByPath(localEntries(result.book.files));
                const diskData = dataByPath(result.diskEntries);

                // Every preflight completes before the first disk mutation. P1-07 repeats the expected fingerprint
                // inside each native command so a change between this check and replacement is also refused.
                return Promise.all(writes.map(preflight)).then(function () {
                    status = 'syncing';
                    let chain = Promise.resolve();
                    writes.forEach(function (action) {
                        chain = chain.then(function () { return writeAction(action, localData); }).then(rememberOperations);
                    });
                    return chain;
                }).then(function () {
                    if (!loads.length) return result.book;
                    return Store.createBookVersion(db, { id: makeId(), bookId: bookId, takenAt: now(),
                        revision: result.book.book.revision }).then(function () {
                            return Promise.all(loads.map(function (action) {
                                const scanned = diskData.get(action.path);
                                if (scanned && (scanned.text !== undefined || scanned.bytes !== undefined || scanned.blob)) {
                                    return Promise.resolve(storedFile(bookId, scanned, cryptoApi));
                                }
                                return adapter.read(action.path, action.expectedExact).then(function (entry) {
                                    return fingerprint(entry, cryptoApi).then(function (mark) {
                                        const check = FileSync.preflight(action.expectedExact, mark);
                                        if (!check.ok) throw problem('folder-changed-before-read',
                                            'The folder changed before Prose could load ' + action.path + '.');
                                        return storedFile(bookId, entry, cryptoApi);
                                    });
                                });
                            }));
                        }).then(function (files) {
                            return Store.applyBookChange(db, { bookId: bookId,
                                expectedRevision: result.book.book.revision,
                                now: Math.max(now(), result.book.book.updatedAt), putFiles: files, removePaths: [] });
                        }).then(function () { return Store.loadBook(db, bookId); });
                }).then(function () {
                    return Promise.all([Store.loadBook(db, bookId), adapter.scan()]);
                }).then(function (values) {
                    const finalBook = values[0];
                    const finalEntries = values[1];
                    return Promise.all([snapshot(localEntries(finalBook.files), cryptoApi),
                        snapshot(finalEntries, cryptoApi)]);
                }).then(function (marks) {
                    const settled = FileSync.plan({ baseline: marks[1], local: marks[0], disk: marks[1] });
                    if (settled.status !== 'synchronized') throw problem('folder-changed-after-sync',
                        'The folder changed before synchronization could record its final snapshot.');
                    return saveLink(marks[1]);
                }).then(function () {
                    if (pendingOperations.length && typeof adapter.finalize === 'function') {
                        return adapter.finalize(pendingOperations);
                    }
                }).then(function () {
                    status = 'synchronized';
                    return publicState();
                }).catch(function (error) {
                    status = error && ['folder-changed-before-write', 'folder-changed-after-sync'].includes(error.code)
                        ? 'paused' : 'sync-failed';
                    throw error;
                });
            });
        }

        function open() {
            requireBoundary();
            const claim = registry.claim(adapter.authorityId, bookId);
            if (!claim.ok) return Promise.reject(problem(claim.code, 'This folder already belongs to another open book.'));
            claimed = true;
            status = link ? 'linked' : 'unlinked';
            return Promise.resolve(publicState());
        }

        function unlink() {
            if (claimed) registry.release(adapter.authorityId, bookId);
            claimed = false;
            link = null;
            status = 'unlinked';
            return publicState();
        }

        return Object.freeze({ open: open, inspect: inspect, sync: sync, state: publicState, unlink: unlink });
    }

    return Object.freeze({ fingerprint: fingerprint, snapshot: snapshot, createRegistry: createRegistry, create: create });
});
