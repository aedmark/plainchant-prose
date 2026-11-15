/* Browser ownership of Prose autosave, emergency text, and crash reconciliation (P1-05, D-021). */
(function (root, factory) {
    root.ProsePersistence = factory(root, root.Store, root.BookRecovery);
})(typeof self !== 'undefined' ? self : this, function (root, Store, Recovery) {
    'use strict';

    const EMERGENCY_DELAY = 250;
    const AUTOSAVE_DELAY = 1500;
    const CHANNEL = 'plainchant_prose_books';

    function problem(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function create(options) {
        const settings = options || {};
        const db = settings.db;
        const bookId = settings.bookId;
        const storage = settings.storage || root.localStorage;
        const now = settings.now || Date.now;
        const later = settings.setTimeout || root.setTimeout.bind(root);
        const cancel = settings.clearTimeout || root.clearTimeout.bind(root);
        const events = settings.events || root;
        const visibilityEvents = settings.visibilityEvents || root.document || events;
        const Channel = settings.BroadcastChannel === undefined ? root.BroadcastChannel : settings.BroadcastChannel;
        const onState = typeof settings.onState === 'function' ? settings.onState : function () {};
        const dirty = new Map();
        const removals = new Map();
        let durable = null;
        let intents = [];
        let emergency = null;
        let emergencyTimer = null;
        let autosaveTimer = null;
        let generation = 0;
        let queue = null;
        let status = 'closed';
        let warning = null;
        let emergencyUnavailable = false;
        let disposed = false;
        let channel = null;

        function state() {
            return Object.freeze({
                status: status,
                warning: warning,
                bookId: bookId,
                revision: durable && durable.book ? durable.book.revision : null,
                dirtyPaths: Array.from(new Set(Array.from(dirty.keys()).concat(Array.from(removals.keys())))).sort(),
                recovery: emergency ? Recovery.reconcile(emergency, durable, intents) : null
            });
        }

        function publish() { onState(state()); }

        function clearTimers() {
            if (emergencyTimer !== null) cancel(emergencyTimer);
            if (autosaveTimer !== null) cancel(autosaveTimer);
            emergencyTimer = null;
            autosaveTimer = null;
        }

        function readEmergency() {
            let raw;
            try { raw = storage.getItem(Recovery.key(bookId)); }
            catch (error) {
                emergencyUnavailable = true;
                warning = 'emergency-unavailable';
                return null;
            }
            if (raw === null) return null;
            try { return JSON.parse(raw); }
            catch (error) { return { format: 0 }; }
        }

        function removeEmergency() {
            try { storage.removeItem(Recovery.key(bookId)); emergency = null; }
            catch (error) { emergencyUnavailable = true; warning = 'emergency-unavailable'; }
        }

        function emergencyFiles() {
            return Array.from(dirty.values()).filter(function (entry) { return entry.file.kind === 'text'; })
                .map(function (entry) { return entry.file; });
        }

        function flushEmergency() {
            if (!durable || (!dirty.size && !removals.size)) return null;
            const textFiles = emergencyFiles();
            if (!textFiles.length && !removals.size) return null;
            const record = Recovery.make(bookId, durable.book.revision, textFiles, Array.from(removals.keys()),
                now(), generation);
            try {
                storage.setItem(Recovery.key(bookId), JSON.stringify(record));
                emergency = record;
                emergencyUnavailable = false;
                if (warning === 'emergency-unavailable') warning = null;
            } catch (error) {
                // setItem is atomic. The previous recovery record remains available when quota or policy refuses this one.
                emergencyUnavailable = true;
                warning = 'emergency-unavailable';
                queueDurable(false).catch(function () {});
            }
            publish();
            return record;
        }

        function schedule() {
            if (emergencyTimer !== null) cancel(emergencyTimer);
            if (autosaveTimer !== null) cancel(autosaveTimer);
            emergencyTimer = later(function () { emergencyTimer = null; flushEmergency(); }, EMERGENCY_DELAY);
            autosaveTimer = later(function () {
                autosaveTimer = null;
                queueDurable(false).catch(function () {});
            }, AUTOSAVE_DELAY);
        }

        function requireEditable() {
            if (!durable || disposed) throw problem('persistence-closed', 'The book persistence session is closed.');
            if (durable.book.deletedAt !== undefined && durable.book.deletedAt !== null) {
                throw problem('book-deleted', 'Restore the book before editing it.');
            }
        }

        function putText(path, role, text) {
            requireEditable();
            generation++;
            dirty.set(path, { generation: generation, file: { path: path, role: role, kind: 'text', text: text } });
            removals.delete(path);
            status = 'dirty';
            schedule();
            publish();
        }

        function removePath(path) {
            requireEditable();
            generation++;
            dirty.delete(path);
            removals.set(path, generation);
            status = 'dirty';
            schedule();
            publish();
        }

        function putBinary(file) {
            try { requireEditable(); } catch (error) { return Promise.reject(error); }
            if (!file || file.kind !== 'binary') return Promise.reject(problem('binary-file-invalid',
                'Immediate binary persistence requires a binary file.'));
            generation++;
            dirty.set(file.path, { generation: generation, file: file });
            removals.delete(file.path);
            status = 'dirty';
            flushEmergency();
            publish();
            return queueDurable(false);
        }

        function broadcast(revision) {
            if (channel) channel.postMessage({ bookId: bookId, revision: revision });
        }

        function storageError(error) {
            if (error && typeof error.code === 'string') return error;
            const classified = Store.classifyError(error);
            return problem(classified.code, classified.message);
        }

        function failedSave(error) {
            const classified = storageError(error);
            status = emergencyUnavailable ? 'recovery-blocked' : 'save-failed';
            warning = classified.code;
            publish();
            throw classified;
        }

        function durableOnce() {
            if (!durable || (!dirty.size && !removals.size)) return Promise.resolve(state());
            if (intents.length) {
                status = 'pending-intent';
                warning = 'intent-pending';
                publish();
                return Promise.resolve(state());
            }
            const savedFiles = Array.from(dirty.values());
            const savedRemovals = Array.from(removals.entries());
            const expectedRevision = durable.book.revision;
            status = 'saving';
            publish();
            let write;
            try {
                write = Store.applyBookChange(db, {
                    bookId: bookId,
                    expectedRevision: expectedRevision,
                    now: Math.max(now(), durable.book.updatedAt),
                    putFiles: savedFiles.map(function (entry) { return entry.file; }),
                    removePaths: savedRemovals.map(function (entry) { return entry[0]; })
                });
            } catch (error) { return Promise.reject(storageError(error)).catch(failedSave); }
            return write.then(function (written) {
                savedFiles.forEach(function (entry) {
                    const current = dirty.get(entry.file.path);
                    if (current && current.generation === entry.generation) dirty.delete(entry.file.path);
                });
                savedRemovals.forEach(function (entry) {
                    if (removals.get(entry[0]) === entry[1]) removals.delete(entry[0]);
                });
                durable.book = written;
                savedFiles.forEach(function (entry) {
                    const index = durable.files.findIndex(function (file) { return file.path === entry.file.path; });
                    const stored = Object.assign({}, entry.file, { bookId: bookId, revision: written.revision,
                        updatedAt: written.updatedAt });
                    if (index === -1) durable.files.push(stored);
                    else durable.files[index] = stored;
                });
                savedRemovals.forEach(function (entry) {
                    durable.files = durable.files.filter(function (file) { return file.path !== entry[0]; });
                });
                if (dirty.size || removals.size) {
                    status = 'dirty';
                    flushEmergency();
                    schedule();
                } else {
                    status = 'saved';
                    removeEmergency();
                }
                warning = warning === 'intent-pending' ? null : warning;
                broadcast(written.revision);
                publish();
                return state();
            }).catch(failedSave);
        }

        function queueDurable(manual) {
            if (manual) flushEmergency();
            let work;
            try { work = queue ? queue.then(durableOnce, durableOnce) : Promise.resolve(durableOnce()); }
            catch (error) {
                work = Promise.reject(storageError(error));
            }
            const marker = work.then(function () {}, function () {});
            queue = marker;
            marker.then(function () { if (queue === marker) queue = null; });
            return work;
        }

        function recoverRecord(record, snapshot, pending) {
            const decision = Recovery.reconcile(record, snapshot, pending);
            if (decision.status === 'already-durable') {
                removeEmergency();
                status = durable.book.deletedAt !== undefined && durable.book.deletedAt !== null ? 'deleted' : 'saved';
                return Promise.resolve(state());
            }
            if (decision.status !== 'apply') {
                status = 'recovery-' + decision.status;
                warning = decision.code || null;
                publish();
                return Promise.resolve(state());
            }
            return Store.applyBookChange(db, {
                bookId: bookId,
                expectedRevision: record.baseRevision,
                now: Math.max(now(), snapshot.book.updatedAt),
                putFiles: record.files,
                removePaths: record.removePaths
            }).then(function () {
                removeEmergency();
                return Store.loadBook(db, bookId);
            }).then(function (loaded) {
                durable = loaded;
                status = 'recovered';
                warning = null;
                publish();
                return state();
            }).catch(function (error) {
                status = 'recovery-conflict';
                warning = error && error.code || 'storage-failed';
                publish();
                return state();
            });
        }

        function open() {
            if (disposed) return Promise.reject(problem('persistence-closed', 'The session was disposed.'));
            return Promise.all([Store.loadBook(db, bookId), Store.loadBookIntents(db, bookId)]).then(function (values) {
                durable = values[0];
                intents = values[1];
                emergency = readEmergency();
                if (!durable) {
                    status = emergency ? 'recovery-book-missing' : 'book-missing';
                    publish();
                    return state();
                }
                status = durable.book.deletedAt !== undefined && durable.book.deletedAt !== null ? 'deleted' : 'saved';
                if (Channel) {
                    channel = new Channel(CHANNEL);
                    channel.onmessage = function (event) {
                        const message = event && event.data;
                        if (message && message.bookId === bookId && Number.isSafeInteger(message.revision) &&
                            message.revision > durable.book.revision) {
                            status = 'external-change';
                            warning = 'book-revision-conflict';
                            publish();
                        }
                    };
                }
                if (!emergency) { publish(); return state(); }
                return recoverRecord(emergency, durable, intents);
            });
        }

        function softDelete() {
            if (intents.length) return Promise.reject(problem('intent-pending',
                'Resolve the pending multi-file operation before deleting the book.'));
            return queueDurable(true).then(function () {
                if (dirty.size || removals.size) throw problem('book-dirty', 'Pending edits must be saved first.');
                const timestamp = Math.max(now(), durable.book.updatedAt);
                return Store.applyBookChange(db, { bookId: bookId, expectedRevision: durable.book.revision,
                    now: timestamp, putFiles: [], removePaths: [], bookPatch: { deletedAt: timestamp } });
            }).then(function (book) {
                durable.book = book;
                status = 'deleted';
                broadcast(book.revision);
                publish();
                return state();
            });
        }

        function restoreDeleted() {
            if (!durable || durable.book.deletedAt === undefined || durable.book.deletedAt === null) {
                return Promise.reject(problem('book-not-deleted', 'The book is not soft-deleted.'));
            }
            if (intents.length) return Promise.reject(problem('intent-pending',
                'Resolve the pending multi-file operation before restoring the book.'));
            const record = emergency && Recovery.validate(emergency).status === 'valid' ? emergency : null;
            if (record && durable.book.revision !== record.baseRevision + 1) {
                return Promise.reject(problem('emergency-revision-conflict',
                    'The deleted book changed after the emergency record was written.'));
            }
            return Store.applyBookChange(db, {
                bookId: bookId,
                expectedRevision: durable.book.revision,
                now: Math.max(now(), durable.book.updatedAt),
                putFiles: record ? record.files : [],
                removePaths: record ? record.removePaths : [],
                bookPatch: { deletedAt: null }
            }).then(function (book) {
                durable.book = book;
                if (record) removeEmergency();
                return Store.loadBook(db, bookId);
            }).then(function (loaded) {
                durable = loaded;
                status = 'restored';
                warning = null;
                broadcast(loaded.book.revision);
                publish();
                return state();
            });
        }

        function deleteForever(confirmation) {
            if (confirmation !== bookId) return Promise.reject(problem('delete-confirmation-invalid',
                'Permanent deletion requires the exact book identifier.'));
            if (!durable || durable.book.deletedAt === undefined || durable.book.deletedAt === null) {
                return Promise.reject(problem('book-not-deleted', 'Only a soft-deleted book can be deleted forever.'));
            }
            try { storage.removeItem(Recovery.key(bookId)); emergency = null; }
            catch (error) {
                emergencyUnavailable = true;
                warning = 'emergency-unavailable';
                publish();
                return Promise.reject(problem('emergency-unavailable',
                    'Emergency storage must be cleared before permanent deletion.'));
            }
            return Store.deleteBookForever(db, bookId).then(function () {
                durable = null;
                status = 'deleted-forever';
                publish();
                return state();
            });
        }

        function pageHide() { flushEmergency(); }
        function visibilityChange() {
            if (!visibilityEvents || visibilityEvents.visibilityState === 'hidden') flushEmergency();
        }
        if (events && typeof events.addEventListener === 'function') {
            events.addEventListener('pagehide', pageHide);
        }
        if (visibilityEvents && typeof visibilityEvents.addEventListener === 'function') {
            visibilityEvents.addEventListener('visibilitychange', visibilityChange);
        }

        function dispose() {
            clearTimers();
            flushEmergency();
            if (events && typeof events.removeEventListener === 'function') {
                events.removeEventListener('pagehide', pageHide);
            }
            if (visibilityEvents && typeof visibilityEvents.removeEventListener === 'function') {
                visibilityEvents.removeEventListener('visibilitychange', visibilityChange);
            }
            if (channel) channel.close();
            disposed = true;
            status = 'closed';
            publish();
        }

        return Object.freeze({
            open: open,
            state: state,
            putText: putText,
            putBinary: putBinary,
            removePath: removePath,
            flushEmergency: flushEmergency,
            save: function () { return queueDurable(true); },
            softDelete: softDelete,
            restoreDeleted: restoreDeleted,
            deleteForever: deleteForever,
            retention: function () { return durable ? Recovery.retention(durable.book, now()) : null; },
            dispose: dispose
        });
    }

    return Object.freeze({
        EMERGENCY_DELAY: EMERGENCY_DELAY,
        AUTOSAVE_DELAY: AUTOSAVE_DELAY,
        CHANNEL: CHANNEL,
        create: create
    });
});
