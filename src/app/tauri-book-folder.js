/* Dialog-scoped native book-folder adapter (P1-07, D-008). Absolute paths never enter the webview. */
(function (root) {
    'use strict';

    function runtime() {
        const internals = root.__TAURI_INTERNALS__;
        if (!internals || typeof internals.invoke !== 'function') throw new Error('Tauri runtime not available');
        return internals;
    }

    function invoke(command, args) { return runtime().invoke(command, args || {}); }

    function bytesToBase64(bytes) {
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
        }
        return btoa(binary);
    }

    function base64ToBytes(value) {
        const binary = atob(String(value || ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }

    function binaryPayload(payload) {
        if (payload.bytes instanceof Uint8Array) return Promise.resolve(payload.bytes);
        if (payload.blob && typeof payload.blob.arrayBuffer === 'function') {
            return payload.blob.arrayBuffer().then(function (buffer) { return new Uint8Array(buffer); });
        }
        return Promise.reject(new Error('A binary write requires bytes or a Blob.'));
    }

    function missing(error) {
        return error && ['folder-path-not-confined', 'folder-read-failed'].includes(error.code);
    }

    function adapter(bookId, grant) {
        const authorityId = grant.authorityId;
        return Object.freeze({
            authorityId: authorityId,
            displayName: grant.displayName,
            platform: grant.platform,
            scan: function () {
                return invoke('scan_book_folder', { authorityId: authorityId }).then(function (result) {
                    const entries = Array.isArray(result.entries) ? result.entries : [];
                    Object.defineProperty(entries, 'warnings', { value: Object.freeze(result.warnings || []), enumerable: false });
                    return entries;
                });
            },
            read: function (path, expectedExact) {
                return invoke('read_book_entry', { authorityId: authorityId, path: path,
                    expectedExact: expectedExact == null ? null : expectedExact }).then(function (entry) {
                    if (entry.kind === 'binary') entry.bytes = base64ToBytes(entry.data);
                    delete entry.data;
                    return entry;
                }).catch(function (error) {
                    if (expectedExact == null && missing(error)) return null;
                    throw error;
                });
            },
            writeAtomic: function (path, payload, expectedExact) {
                const base = { authorityId: authorityId, path: path, kind: payload.kind,
                    expectedExact: expectedExact == null ? null : expectedExact, text: null, data: null };
                if (payload.kind === 'text') {
                    base.text = String(payload.text == null ? '' : payload.text);
                    return invoke('write_book_entry', base);
                }
                return binaryPayload(payload).then(function (bytes) {
                    base.data = bytesToBase64(bytes);
                    return invoke('write_book_entry', base);
                });
            },
            deleteAtomic: function (path, expectedExact) {
                return invoke('delete_book_entry', { authorityId: authorityId, path: path, expectedExact: expectedExact });
            },
            moveAtomic: function (fromPath, toPath, expectedSource, expectedTarget) {
                return invoke('move_book_entry', { authorityId: authorityId, fromPath: fromPath, toPath: toPath,
                    expectedSource: expectedSource, expectedTarget: expectedTarget == null ? null : expectedTarget });
            },
            finalize: function (operationIds) {
                return invoke('finalize_book_operations', { authorityId: authorityId, operationIds: operationIds });
            },
            rollback: function (operationIds) {
                return invoke('rollback_book_operations', { authorityId: authorityId, operationIds: operationIds });
            },
            watch: function (onChange) {
                const internals = runtime();
                if (typeof internals.transformCallback !== 'function') {
                    return Promise.reject(new Error('Tauri event callbacks are unavailable.'));
                }
                const callback = internals.transformCallback(function (event) {
                    const payload = event && event.payload ? event.payload : event;
                    if (payload && payload.authorityId === authorityId) onChange(payload.generation);
                });
                return invoke('plugin:event|listen', { event: 'prose-folder-changed', target: { kind: 'Any' },
                    handler: callback }).then(function (eventId) {
                    return invoke('start_book_folder_watch', { authorityId: authorityId }).then(function () {
                        return function () {
                            return invoke('stop_book_folder_watch', { authorityId: authorityId }).then(function () {
                                if (root.__TAURI_EVENT_PLUGIN_INTERNALS__ &&
                                    typeof root.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener === 'function') {
                                    root.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener('prose-folder-changed', eventId);
                                }
                                return invoke('plugin:event|unlisten', { event: 'prose-folder-changed', eventId: eventId });
                            });
                        };
                    });
                });
            },
            release: function () {
                return invoke('release_book_folder', { authorityId: authorityId, bookId: bookId });
            }
        });
    }

    root.ProseNativeFolders = Object.freeze({
        available: function () { return Boolean(root.__TAURI_INTERNALS__); },
        select: function (bookId) {
            return invoke('select_book_folder', { bookId: bookId }).then(function (grant) {
                return grant ? adapter(bookId, grant) : null;
            });
        }
    });
})(typeof self !== 'undefined' ? self : this);
