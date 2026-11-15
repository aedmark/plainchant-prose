/*
 * Pure emergency-buffer and retention rules for Plainchant Prose (P1-05, D-021).
 * Browser storage and timers belong to src/app/book-persistence.js.
 */
(function (root, factory) {
    const api = factory(root.StoreSchema || (typeof require === 'function' ? require('./store-schema.js') : null));
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BookRecovery = api;
})(typeof self !== 'undefined' ? self : this, function (Schema) {
    'use strict';

    const FORMAT = 1;
    const KEY_PREFIX = 'plainchant_prose_book_emergency:';
    const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

    function result(status, extra) {
        return Object.freeze(Object.assign({ status: status }, extra || {}));
    }

    function validTime(value) {
        return Number.isSafeInteger(value) && value >= 0;
    }

    function validate(record) {
        if (!record || typeof record !== 'object' || Array.isArray(record) || record.format !== FORMAT) {
            return result('invalid', { code: 'emergency-format-invalid' });
        }
        if (!Schema.validId(record.bookId) || !Number.isSafeInteger(record.baseRevision) ||
            record.baseRevision < 0 || !validTime(record.updatedAt) || !Number.isSafeInteger(record.generation) ||
            record.generation < 1 || !Array.isArray(record.files) || !Array.isArray(record.removePaths)) {
            return result('invalid', { code: 'emergency-record-invalid' });
        }
        if (!record.files.length && !record.removePaths.length) {
            return result('invalid', { code: 'emergency-empty' });
        }
        if (record.files.length + record.removePaths.length > Schema.MAX_FILES) {
            return result('invalid', { code: 'emergency-file-count-invalid' });
        }
        const paths = new Set();
        let total = 0;
        for (const file of record.files) {
            if (!file || file.kind !== 'text' || !Schema.validPath(file.path) ||
                !['index', 'chapter', 'research'].includes(file.role) || typeof file.text !== 'string' ||
                file.text.length > Schema.MAX_TEXT_LENGTH || paths.has(file.path)) {
                return result('invalid', { code: 'emergency-file-invalid' });
            }
            const stored = Object.assign({}, file, { bookId: record.bookId, revision: record.baseRevision,
                updatedAt: record.updatedAt });
            if (!Schema.validateFile(stored, false).ok) {
                return result('invalid', { code: 'emergency-file-invalid' });
            }
            paths.add(file.path);
            total += file.text.length * 2;
            if (total > Schema.MAX_BOOK_SIZE) return result('invalid', { code: 'emergency-size-invalid' });
        }
        for (const path of record.removePaths) {
            if (!Schema.validPath(path) || paths.has(path)) {
                return result('invalid', { code: 'emergency-path-invalid' });
            }
            paths.add(path);
        }
        return result('valid');
    }

    function make(bookId, baseRevision, files, removePaths, updatedAt, generation) {
        const record = {
            format: FORMAT,
            bookId: bookId,
            baseRevision: baseRevision,
            updatedAt: updatedAt,
            generation: generation,
            files: (files || []).map(function (file) {
                return { path: file.path, role: file.role, kind: 'text', text: file.text };
            }).sort(function (left, right) { return left.path.localeCompare(right.path); }),
            removePaths: (removePaths || []).slice().sort()
        };
        const verdict = validate(record);
        if (verdict.status !== 'valid') {
            const problem = new Error('The emergency record is invalid.');
            problem.code = verdict.code;
            throw problem;
        }
        return Object.freeze(record);
    }

    function key(bookId) {
        if (!Schema.validId(bookId)) throw new TypeError('A valid book identifier is required.');
        return KEY_PREFIX + bookId;
    }

    function sameAfterImage(record, snapshot) {
        const files = new Map((snapshot.files || []).map(function (file) { return [file.path, file]; }));
        return record.files.every(function (wanted) {
            const stored = files.get(wanted.path);
            return stored && stored.kind === 'text' && stored.role === wanted.role && stored.text === wanted.text;
        }) && record.removePaths.every(function (path) { return !files.has(path); });
    }

    function reconcile(record, snapshot, intents) {
        const verdict = validate(record);
        if (verdict.status !== 'valid') return verdict;
        if (!snapshot || !snapshot.book) return result('book-missing', { code: 'emergency-book-missing' });
        if (snapshot.book.id !== record.bookId) return result('invalid', { code: 'emergency-owner-mismatch' });
        if (Array.isArray(intents) && intents.length) {
            return result('pending-intent', { code: 'emergency-intent-pending' });
        }
        if (snapshot.book.deletedAt !== undefined && snapshot.book.deletedAt !== null) {
            return result('book-deleted', { code: 'emergency-book-deleted' });
        }
        if (sameAfterImage(record, snapshot)) return result('already-durable');
        if (snapshot.book.revision === record.baseRevision) return result('apply');
        return result('conflict', { code: 'emergency-revision-conflict' });
    }

    function retention(book, now) {
        if (!book || book.deletedAt === undefined || book.deletedAt === null) return result('active');
        if (!validTime(book.deletedAt) || !validTime(now)) return result('invalid', { code: 'retention-time-invalid' });
        const age = Math.max(0, now - book.deletedAt);
        return result(age < RETENTION_MS ? 'recoverable' : 'expired-warning', {
            age: age,
            remaining: Math.max(0, RETENTION_MS - age),
            physicallyDeleted: false
        });
    }

    return Object.freeze({
        FORMAT: FORMAT,
        KEY_PREFIX: KEY_PREFIX,
        RETENTION_MS: RETENTION_MS,
        key: key,
        make: make,
        validate: validate,
        reconcile: reconcile,
        retention: retention,
        sameAfterImage: sameAfterImage
    });
});
