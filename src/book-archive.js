/* Explicit, bounded browser transfer package for Prose book folders (P1-06, D-012, D-022). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./zip.js'), require('./epub.js'));
    else root.BookArchive = factory(root.Zip, root.Epub);
})(typeof self !== 'undefined' ? self : this, function (Zip, Epub) {
    'use strict';

    const LIMITS = Object.freeze({ file: 64 * 1024 * 1024, total: 256 * 1024 * 1024, entries: 10000 });

    function problem(code, message, path) {
        const error = new Error(message);
        error.code = code;
        if (path) error.path = path;
        return error;
    }

    function validPath(path) {
        if (typeof path !== 'string' || !path || path.length > 1024 || path.indexOf('\\') !== -1 ||
            path.startsWith('/') || /^[A-Za-z]:/.test(path) || /[\x00-\x1f\x7f]/.test(path)) return false;
        return !path.split('/').some(function (part) { return !part || part === '.' || part === '..'; });
    }

    function role(path) {
        if (path === 'book.txt') return 'index';
        if (path.startsWith('research/')) return 'research';
        if (/\.md$/i.test(path)) return 'chapter';
        return null;
    }

    function asBytes(entry) {
        if (entry.kind === 'text' && typeof entry.text === 'string') return Promise.resolve(new TextEncoder().encode(entry.text));
        const value = entry.bytes || entry.blob;
        if (value instanceof Uint8Array) return Promise.resolve(value);
        if (value instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(value));
        if (value && typeof value.arrayBuffer === 'function') {
            return value.arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
        }
        return Promise.reject(problem('book-package-entry-invalid', 'A book package entry has no readable content.', entry.path));
    }

    function validateNames(entries) {
        if (!Array.isArray(entries) || entries.length > LIMITS.entries) throw problem('book-package-too-many',
            'A book package contains more than 10,000 files.');
        const names = new Map();
        let indexes = 0;
        entries.forEach(function (entry) {
            if (!entry || !validPath(entry.path) || !role(entry.path)) throw problem('book-package-path-invalid',
                'A book package path is outside the Prose book-folder contract.', entry && entry.path);
            const key = entry.path.normalize('NFC').toLowerCase();
            if (names.has(key)) throw problem('book-package-path-collision',
                'Two book package paths are the same after Unicode and case normalization.', entry.path);
            names.set(key, entry.path);
            if (entry.path === 'book.txt') indexes++;
        });
        if (indexes !== 1) throw problem('book-package-index-invalid', 'A book package needs exactly one book.txt file.');
    }

    async function build(entries, when) {
        validateNames(entries);
        let total = 0;
        const files = [];
        const ordered = entries.slice().sort(function (a, b) {
            if (a.path === 'book.txt') return -1;
            if (b.path === 'book.txt') return 1;
            return a.path.localeCompare(b.path);
        });
        for (const entry of ordered) {
            const bytes = await asBytes(entry);
            if (bytes.length > LIMITS.file) throw problem('book-package-file-too-large',
                'A book package file exceeds 64 MiB.', entry.path);
            total += bytes.length;
            if (total > LIMITS.total) throw problem('book-package-too-large',
                'A book package exceeds 256 MiB.');
            files.push({ path: entry.path, data: bytes });
        }
        return Zip.build(files, when);
    }

    async function read(bytes) {
        let unpacked;
        try { unpacked = await Epub.unzip(bytes, { kind: 'book-folder', limits: LIMITS }); }
        catch (error) {
            if (error && error.code) throw error;
            throw problem('book-package-damaged', 'The book package could not be read.');
        }
        const names = Object.keys(unpacked.raw);
        validateNames(names.map(function (path) { return { path: path }; }));
        const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
        return Object.freeze(names.sort(function (a, b) {
            if (a === 'book.txt') return -1;
            if (b === 'book.txt') return 1;
            return a.localeCompare(b);
        }).map(function (path) {
            const bytes = unpacked.raw[path];
            if (role(path) === 'research') return Object.freeze({ path: path, role: 'research', kind: 'binary', bytes: bytes });
            try { return Object.freeze({ path: path, role: role(path), kind: 'text', text: decoder.decode(bytes) }); }
            catch (error) { throw problem('book-package-text-invalid', 'A manuscript file is not valid UTF-8.', path); }
        }));
    }

    return Object.freeze({ LIMITS: LIMITS, validPath: validPath, role: role, build: build, read: read });
});
