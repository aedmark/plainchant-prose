/*
 * Pure IndexedDB record and recovery rules for Plainchant Prose (P1-04, D-007).
 * This module validates untrusted stored data without touching IndexedDB or another environment API.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.StoreSchema = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DB_VERSION = 3;
    const MAX_FILES = 10000;
    const MAX_TEXT_LENGTH = 5 * 1024 * 1024;
    const MAX_BINARY_SIZE = 64 * 1024 * 1024;
    const MAX_BOOK_SIZE = 256 * 1024 * 1024;
    const MAX_AUXILIARY_JSON = 1024 * 1024;
    const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
    const STORE_NAMES = Object.freeze({
        books: 'books',
        files: 'bookFiles',
        ui: 'bookUi',
        versions: 'bookVersions',
        versionFiles: 'bookVersionFiles',
        intents: 'bookIntents',
        targets: 'targets',
        links: 'folderLinks',
        handoffs: 'handoffs',
        meta: 'meta'
    });

    function verdict(ok, code, message) {
        return Object.freeze({ ok: ok, code: code, message: message });
    }

    function accepted() {
        return verdict(true, 'valid', 'The record is valid.');
    }

    function refused(code, message) {
        return verdict(false, code, message);
    }

    function plainObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    function validId(value) {
        return typeof value === 'string' && ID_PATTERN.test(value);
    }

    function validTime(value) {
        return Number.isSafeInteger(value) && value >= 0;
    }

    function validRevision(value) {
        return Number.isSafeInteger(value) && value >= 0;
    }

    function validPath(value) {
        if (typeof value !== 'string' || !value || value.length > 1024 || value.indexOf('\\') !== -1 ||
            value.startsWith('/') || /^[A-Za-z]:/.test(value) || /[\x00-\x1f\x7f]/.test(value)) return false;
        const parts = value.split('/');
        return !parts.some(function (part) { return !part || part === '.' || part === '..'; });
    }

    function binarySize(value) {
        if (!value || typeof value !== 'object') return -1;
        if (Number.isSafeInteger(value.size) && value.size >= 0) return value.size;
        if (Number.isSafeInteger(value.byteLength) && value.byteLength >= 0) return value.byteLength;
        return -1;
    }

    function fileSize(record) {
        return record && record.kind === 'text' && typeof record.text === 'string'
            ? record.text.length * 2 : binarySize(record && record.blob);
    }

    function validateBook(record) {
        if (!plainObject(record)) return refused('book-not-object', 'A book record must be an object.');
        if (!validId(record.id)) return refused('book-id-invalid', 'A book needs a bounded identifier.');
        if (typeof record.title !== 'string' || record.title.length > 1000) {
            return refused('book-title-invalid', 'A book title must be a bounded string.');
        }
        if (!validTime(record.createdAt) || !validTime(record.updatedAt) || record.updatedAt < record.createdAt) {
            return refused('book-time-invalid', 'Book timestamps are invalid.');
        }
        if (!validRevision(record.revision)) return refused('book-revision-invalid', 'Book revision is invalid.');
        if (record.deletedAt !== undefined && record.deletedAt !== null &&
            (!validTime(record.deletedAt) || record.deletedAt < record.createdAt)) {
            return refused('book-deleted-time-invalid', 'Book deletion time is invalid.');
        }
        return accepted();
    }

    function validateFile(record, versionFile) {
        const label = versionFile ? 'version file' : 'book file';
        if (!plainObject(record)) return refused('file-not-object', 'A ' + label + ' record must be an object.');
        if (!validId(record.bookId)) return refused('file-book-id-invalid', 'A ' + label + ' needs a book identifier.');
        if (versionFile && !validId(record.versionId)) {
            return refused('version-file-version-id-invalid', 'A version file needs a version identifier.');
        }
        if (!validPath(record.path)) return refused('file-path-invalid', 'A ' + label + ' path is invalid.');
        if (!['index', 'chapter', 'research'].includes(record.role)) {
            return refused('file-role-invalid', 'A ' + label + ' role is invalid.');
        }
        const research = record.path.startsWith('research/');
        if (record.role === 'index' && record.path !== 'book.txt') {
            return refused('file-index-path-invalid', 'The index record must be book.txt.');
        }
        if (record.role === 'chapter' && (research || !record.path.endsWith('.md'))) {
            return refused('file-chapter-path-invalid', 'A chapter record must be a non-research .md path.');
        }
        if (record.role === 'research' && !research) {
            return refused('file-research-path-invalid', 'A research record must stay below research/.');
        }
        if (record.kind === 'text') {
            if (typeof record.text !== 'string' || record.text.length > MAX_TEXT_LENGTH ||
                Object.prototype.hasOwnProperty.call(record, 'blob')) {
                return refused('file-text-invalid', 'A text file exceeds its limit or has an invalid payload.');
            }
        } else if (record.kind === 'binary') {
            const size = binarySize(record.blob);
            if (record.role !== 'research' || size < 0 || size > MAX_BINARY_SIZE ||
                Object.prototype.hasOwnProperty.call(record, 'text') || typeof record.fingerprint !== 'string' ||
                !record.fingerprint || record.fingerprint.length > 256) {
                return refused('file-binary-invalid', 'A binary research file exceeds its limit or has an invalid payload.');
            }
        } else return refused('file-kind-invalid', 'A file kind must be text or binary.');
        if (!versionFile) {
            if (!validRevision(record.revision)) return refused('file-revision-invalid', 'A file revision is invalid.');
            if (!validTime(record.updatedAt)) return refused('file-time-invalid', 'A file timestamp is invalid.');
        }
        return accepted();
    }

    function validateSnapshot(book, files) {
        const bookResult = validateBook(book);
        if (!bookResult.ok) return bookResult;
        if (!Array.isArray(files) || files.length > MAX_FILES) {
            return refused('book-file-count-invalid', 'A book has too many files or no file list.');
        }
        const paths = new Set();
        let total = 0;
        let indexCount = 0;
        for (const file of files) {
            const result = validateFile(file, false);
            if (!result.ok) return result;
            if (file.bookId !== book.id) return refused('book-file-owner-mismatch', 'A file belongs to another book.');
            if (paths.has(file.path)) return refused('book-file-path-duplicate', 'A book contains a repeated file path.');
            paths.add(file.path);
            if (file.role === 'index') indexCount++;
            total += fileSize(file);
            if (total > MAX_BOOK_SIZE) return refused('book-size-invalid', 'The book exceeds its stored-size limit.');
        }
        if (indexCount !== 1) return refused('book-index-count-invalid', 'A book needs exactly one book.txt record.');
        return accepted();
    }

    function validateVersion(record) {
        if (!plainObject(record)) return refused('version-not-object', 'A version record must be an object.');
        if (!validId(record.id) || !validId(record.bookId)) {
            return refused('version-id-invalid', 'A version needs bounded identifiers.');
        }
        if (!validTime(record.takenAt) || !validRevision(record.revision)) {
            return refused('version-state-invalid', 'A version timestamp or revision is invalid.');
        }
        if (record.name !== undefined && (typeof record.name !== 'string' || record.name.length > 500)) {
            return refused('version-name-invalid', 'A version name is invalid.');
        }
        if (record.note !== undefined && (typeof record.note !== 'string' || record.note.length > 5000)) {
            return refused('version-note-invalid', 'A version note is invalid.');
        }
        return accepted();
    }

    function validateVersionSnapshot(version, files) {
        const header = validateVersion(version);
        if (!header.ok) return header;
        if (!Array.isArray(files) || files.length > MAX_FILES) {
            return refused('version-file-count-invalid', 'A version has too many files or no file list.');
        }
        const paths = new Set();
        let total = 0;
        let indexCount = 0;
        for (const file of files) {
            const result = validateFile(file, true);
            if (!result.ok) return result;
            if (file.bookId !== version.bookId || file.versionId !== version.id) {
                return refused('version-file-owner-mismatch', 'A version file belongs to another snapshot.');
            }
            if (paths.has(file.path)) return refused('version-file-path-duplicate',
                'A version contains a repeated file path.');
            paths.add(file.path);
            if (file.role === 'index') indexCount++;
            total += fileSize(file);
            if (total > MAX_BOOK_SIZE) return refused('version-size-invalid', 'The version exceeds its stored-size limit.');
        }
        if (indexCount !== 1) return refused('version-index-count-invalid',
            'A version needs exactly one book.txt record.');
        return accepted();
    }

    function comparableFile(file) {
        if (file === null) return null;
        if (!plainObject(file)) return undefined;
        return {
            bookId: file.bookId,
            path: file.path,
            role: file.role,
            kind: file.kind,
            fingerprint: file.fingerprint,
            payload: file.kind === 'text' ? file.text : file.blob
        };
    }

    function sameFile(left, right) {
        if (left === null || right === null) return left === right;
        const a = comparableFile(left);
        const b = comparableFile(right);
        if (!a || !b || a.bookId !== b.bookId || a.path !== b.path || a.role !== b.role || a.kind !== b.kind) {
            return false;
        }
        if (a.kind === 'text') return a.payload === b.payload;
        return a.fingerprint === b.fingerprint && binarySize(a.payload) === binarySize(b.payload) &&
            a.payload && b.payload && a.payload.type === b.payload.type;
    }

    function validateIntent(record) {
        if (!plainObject(record)) return refused('intent-not-object', 'An intent record must be an object.');
        if (!validId(record.id) || !validId(record.bookId)) {
            return refused('intent-id-invalid', 'An intent needs bounded identifiers.');
        }
        if (!['prepared', 'applied'].includes(record.state) || !validRevision(record.baseRevision) ||
            !validTime(record.createdAt)) return refused('intent-state-invalid', 'Intent state is invalid.');
        if (record.state === 'applied' && (!validRevision(record.appliedRevision) ||
            record.appliedRevision !== record.baseRevision + 1)) {
            return refused('intent-applied-revision-invalid', 'An applied intent needs its committed revision.');
        }
        if (record.state === 'prepared' && record.appliedRevision !== undefined) {
            return refused('intent-applied-revision-invalid', 'A prepared intent cannot have an applied revision.');
        }
        if (!Array.isArray(record.changes) || !record.changes.length || record.changes.length > MAX_FILES) {
            return refused('intent-changes-invalid', 'An intent needs a bounded nonempty change list.');
        }
        const paths = new Set();
        for (const change of record.changes) {
            if (!plainObject(change) || !validPath(change.path) || paths.has(change.path)) {
                return refused('intent-path-invalid', 'Intent paths must be unique and valid.');
            }
            paths.add(change.path);
            if (change.before === null && change.after === null) {
                return refused('intent-empty-change', 'An intent change cannot be empty.');
            }
            for (const file of [change.before, change.after]) {
                if (file === null) continue;
                const result = validateFile(file, false);
                if (!result.ok) return result;
                if (file.bookId !== record.bookId || file.path !== change.path) {
                    return refused('intent-file-mismatch', 'Intent file identity does not match its change.');
                }
            }
        }
        return accepted();
    }

    function jsonSize(value) {
        try { return JSON.stringify(value).length; } catch (problem) { return Infinity; }
    }

    function validateAuxiliary(kind, record) {
        if (!plainObject(record) || !validId(record.bookId) || jsonSize(record) > MAX_AUXILIARY_JSON) {
            return refused(kind + '-invalid', 'The ' + kind + ' record is invalid or too large.');
        }
        if (kind === 'book-ui') return accepted();
        if (kind === 'target') return accepted();
        if (kind === 'folder-link') {
            if (['path', 'rootPath', 'permissionToken', 'grant', 'grantId', 'handle', 'directoryHandle',
                'authorityId'].some(function (key) {
                return Object.prototype.hasOwnProperty.call(record, key);
            })) return refused('folder-link-authority-invalid',
                'Persisted folder metadata cannot contain filesystem authority.');
            if (typeof record.displayName !== 'string' || record.displayName.length > 1000 ||
                typeof record.platform !== 'string' || record.platform.length > 100 ||
                !Array.isArray(record.fingerprints) || record.fingerprints.length > MAX_FILES) {
                return refused('folder-link-invalid', 'Folder-link metadata is invalid.');
            }
            const paths = new Set();
            for (const item of record.fingerprints) {
                const carriesAuthority = plainObject(item) && ['rootPath', 'permissionToken', 'grant', 'grantId',
                    'handle', 'directoryHandle', 'authorityId'].some(function (key) {
                        return Object.prototype.hasOwnProperty.call(item, key);
                    });
                const current = plainObject(item) && ['text', 'binary'].includes(item.kind) &&
                    typeof item.exact === 'string' && /^sha256:[0-9a-f]{64}$/.test(item.exact) &&
                    typeof item.canonical === 'string' && /^sha256:[0-9a-f]{64}$/.test(item.canonical) &&
                    (item.kind !== 'binary' || item.canonical === item.exact);
                const legacy = plainObject(item) && typeof item.fingerprint === 'string' &&
                    item.fingerprint.length > 0 && item.fingerprint.length <= 256;
                if (!plainObject(item) || carriesAuthority || !validPath(item.path) || (!current && !legacy) ||
                    paths.has(item.path)) {
                    return refused('folder-link-fingerprint-invalid',
                    'A folder-link fingerprint is invalid.');
                }
                paths.add(item.path);
            }
            return accepted();
        }
        if (kind === 'handoff') {
            if (!validId(record.id) || !validTime(record.createdAt) || !validRevision(record.sourceRevision) ||
                typeof record.fileName !== 'string' || record.fileName.length > 1000 ||
                typeof record.fingerprint !== 'string' || !record.fingerprint || record.fingerprint.length > 256) {
                return refused('handoff-invalid', 'A handoff record is invalid.');
            }
            return accepted();
        }
        return refused('auxiliary-kind-invalid', 'The auxiliary record kind is unknown.');
    }

    function classifyError(error) {
        const name = error && typeof error.name === 'string' ? error.name : '';
        const code = error && typeof error.code === 'string' ? error.code : '';
        if (code) return verdict(false, code, 'The storage operation was refused.');
        if (name === 'QuotaExceededError') return verdict(false, 'storage-quota', 'Browser storage quota was exceeded.');
        if (name === 'VersionError') return verdict(false, 'storage-newer-schema', 'The database uses a newer schema.');
        if (name === 'AbortError') return verdict(false, 'storage-aborted', 'The storage transaction was aborted.');
        if (name === 'ConstraintError') return verdict(false, 'storage-conflict', 'A stored key already exists.');
        if (name === 'InvalidStateError') return verdict(false, 'storage-closed', 'The database connection is closed.');
        return verdict(false, 'storage-failed', 'The storage operation failed.');
    }

    return {
        DB_VERSION: DB_VERSION,
        STORE_NAMES: STORE_NAMES,
        MAX_FILES: MAX_FILES,
        MAX_TEXT_LENGTH: MAX_TEXT_LENGTH,
        MAX_BINARY_SIZE: MAX_BINARY_SIZE,
        MAX_BOOK_SIZE: MAX_BOOK_SIZE,
        validId: validId,
        validPath: validPath,
        fileSize: fileSize,
        sameFile: sameFile,
        validateBook: validateBook,
        validateFile: validateFile,
        validateSnapshot: validateSnapshot,
        validateVersion: validateVersion,
        validateVersionSnapshot: validateVersionSnapshot,
        validateIntent: validateIntent,
        validateAuxiliary: validateAuxiliary,
        classifyError: classifyError
    };
});
