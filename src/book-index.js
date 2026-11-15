/*
 * Lossless book.txt reader and order-splice planner for Plainchant Prose (P1-03, D-002, D-018).
 * The model is derived and immutable. reorder() returns an explicit edit and never serializes the model over source.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BookIndex = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DEFAULT_MAX_SOURCE_LENGTH = 5 * 1024 * 1024;
    const STANDARD_KEYS = {
        title: { name: 'Title', property: 'title', required: true },
        author: { name: 'Author', property: 'author', required: true },
        language: { name: 'Language', property: 'language', required: true },
        'publish date': { name: 'Publish Date', property: 'publishDate', required: false },
        publisher: { name: 'Publisher', property: 'publisher', required: false },
        series: { name: 'Series', property: 'series', required: false }
    };

    function ranged(start, end) {
        return { start: start, end: end };
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
        return value;
    }

    function lineRecords(source) {
        const lines = [];
        let start = 0;
        while (start < source.length) {
            const newline = source.indexOf('\n', start);
            const fullEnd = newline === -1 ? source.length : newline + 1;
            let end = newline === -1 ? source.length : newline;
            let lineEnding = newline === -1 ? '' : '\n';
            if (end > start && source.charAt(end - 1) === '\r') {
                end--;
                lineEnding = '\r\n';
            }
            lines.push({
                start: start,
                end: end,
                fullEnd: fullEnd,
                text: source.slice(start, end),
                lineEnding: lineEnding
            });
            start = fullEnd;
        }
        if (!lines.length) lines.push({ start: 0, end: 0, fullEnd: 0, text: '', lineEnding: '' });
        return lines;
    }

    function detectedLineEnding(lines) {
        for (const line of lines) if (line.lineEnding) return line.lineEnding;
        return '';
    }

    function trimHorizontal(text) {
        let start = 0;
        let end = text.length;
        while (start < end && (text.charAt(start) === ' ' || text.charAt(start) === '\t')) start++;
        while (end > start && (text.charAt(end - 1) === ' ' || text.charAt(end - 1) === '\t')) end--;
        return { text: text.slice(start, end), start: start, end: end };
    }

    function diagnostic(code, severity, exportBlocking, start, end) {
        const problem = {
            code: code,
            severity: severity,
            path: 'book.txt',
            exportBlocking: Boolean(exportBlocking)
        };
        if (Number.isInteger(start) && Number.isInteger(end)) problem.range = ranged(start, end);
        return problem;
    }

    function parseMetadataLine(line, diagnostics) {
        const colon = line.text.indexOf(':');
        if (colon === -1) return null;
        const keyBits = trimHorizontal(line.text.slice(0, colon));
        const valueBits = trimHorizontal(line.text.slice(colon + 1));
        const key = keyBits.text;
        const value = valueBits.text;
        const standard = STANDARD_KEYS[key.toLowerCase()];
        const node = {
            type: 'metadata',
            key: key,
            value: value,
            range: ranged(line.start, line.end),
            keyRange: ranged(line.start + keyBits.start, line.start + keyBits.end),
            valueRange: ranged(line.start + colon + 1 + valueBits.start, line.start + colon + 1 + valueBits.end)
        };
        if (standard) {
            node.canonicalKey = standard.name;
            node.property = standard.property;
            if (key !== standard.name) {
                diagnostics.push(diagnostic('metadata-key-case', 'warning', false, line.start, line.end));
            }
            return node;
        }
        if (key.toLowerCase() !== 'custom') return node;
        node.canonicalKey = 'Custom';
        node.property = 'custom';
        if (key !== 'Custom') diagnostics.push(diagnostic('metadata-key-case', 'warning', false, line.start, line.end));
        const equals = value.indexOf('=');
        if (equals === -1) return node;
        const nameBits = trimHorizontal(value.slice(0, equals));
        const customValueBits = trimHorizontal(value.slice(equals + 1));
        node.customName = nameBits.text;
        node.value = customValueBits.text;
        const valueBase = node.valueRange.start;
        node.customNameRange = ranged(valueBase + nameBits.start, valueBase + nameBits.end);
        node.valueRange = ranged(valueBase + equals + 1 + customValueBits.start,
            valueBase + equals + 1 + customValueBits.end);
        return node;
    }

    function validLanguage(value) {
        return /^(?:[A-Za-z]{2,8})(?:-[A-Za-z0-9]{1,8})*$/.test(value);
    }

    function validDate(value) {
        const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
        if (!match) return false;
        if (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 12)) return false;
        if (match[3]) {
            const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
            return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 &&
                date.getUTCDate() === Number(match[3]);
        }
        return true;
    }

    function duplicateCode(property) {
        return 'metadata-duplicate-' + property.replace(/[A-Z]/g, function (letter) {
            return '-' + letter.toLowerCase();
        });
    }

    function unsafePathCode(path) {
        if (path.indexOf('\\') !== -1) return 'chapter-path-backslash';
        if (/^[A-Za-z]:/.test(path) || path.startsWith('/')) return 'chapter-path-absolute';
        if (/[\x00-\x1f\x7f]/.test(path)) return 'chapter-path-control';
        const parts = path.split('/');
        if (parts.some(function (part) { return !part || part === '.' || part === '..'; })) {
            return 'chapter-path-traversal';
        }
        if (parts[0].toLowerCase() === 'research') return 'chapter-path-research';
        return null;
    }

    function emptyModel(source, lines, diagnostics) {
        const at = source.length;
        return deepFreeze({
            type: 'book-index',
            rangeUnit: 'utf16-code-unit',
            lineEnding: detectedLineEnding(lines),
            metadata: {},
            metadataEntries: [],
            customMetadata: [],
            parts: [],
            chapterEntries: [],
            orderItems: [],
            unknownLines: [],
            orderedRange: ranged(at, at),
            orderRange: ranged(at, at),
            orderedSource: '',
            diagnostics: diagnostics,
            exportBlocking: true
        });
    }

    function read(input, options) {
        const source = typeof input === 'string' ? input : '';
        const diagnostics = [];
        const requested = options && Number.isInteger(options.maxSourceLength) && options.maxSourceLength > 0
            ? options.maxSourceLength : DEFAULT_MAX_SOURCE_LENGTH;
        const limit = Math.min(DEFAULT_MAX_SOURCE_LENGTH, requested);
        if (source.length > limit) {
            diagnostics.push(diagnostic('source-too-large', 'conflict', true, 0, Math.min(source.length, 1)));
            return emptyModel(source, [], diagnostics);
        }
        const lines = lineRecords(source);

        const hasBom = source.charAt(0) === '\uFEFF';
        if (hasBom) diagnostics.push(diagnostic('source-bom', 'warning', false, 0, 1));
        let split = lines.findIndex(function (line) { return /^[ \t]*$/.test(line.text); });
        if (split === -1) split = lines.length;
        const metadataEntries = [];
        const unknownLines = [];
        for (let index = 0; index < split; index++) {
            const physical = lines[index];
            const line = index === 0 && hasBom ? {
                start: physical.start + 1,
                end: physical.end,
                fullEnd: physical.fullEnd,
                text: physical.text.slice(1),
                lineEnding: physical.lineEnding
            } : physical;
            const entry = parseMetadataLine(line, diagnostics);
            if (!entry) {
                diagnostics.push(diagnostic('metadata-unknown-line', 'conflict', true, line.start, line.end));
                unknownLines.push({ type: 'unknown', block: 'metadata', range: ranged(line.start, line.end) });
                continue;
            }
            if (!entry.canonicalKey) {
                diagnostics.push(diagnostic('metadata-unknown-key', 'conflict', true, line.start, line.end));
            } else if (entry.property === 'custom' &&
                (!entry.customName || !/^[A-Za-z0-9 _-]+$/.test(entry.customName))) {
                diagnostics.push(diagnostic('metadata-custom-invalid', 'conflict', true, line.start, line.end));
            }
            metadataEntries.push(entry);
        }

        const metadata = {};
        const customMetadata = [];
        Object.keys(STANDARD_KEYS).forEach(function (lookup) {
            const spec = STANDARD_KEYS[lookup];
            const entries = metadataEntries.filter(function (entry) { return entry.property === spec.property; });
            if (!entries.length) {
                if (spec.required) diagnostics.push(diagnostic('metadata-required-missing', 'conflict', true));
                return;
            }
            if (entries.length > 1) {
                entries.slice(1).forEach(function (entry) {
                    diagnostics.push(diagnostic(duplicateCode(spec.property), 'warning', true,
                        entry.range.start, entry.range.end));
                });
                metadata[spec.property] = null;
                return;
            }
            const entry = entries[0];
            if (!entry.value && spec.required) {
                diagnostics.push(diagnostic('metadata-required-empty', 'conflict', true,
                    entry.range.start, entry.range.end));
                metadata[spec.property] = null;
            } else metadata[spec.property] = entry;
            if (entry.value && spec.property === 'language' && !validLanguage(entry.value)) {
                diagnostics.push(diagnostic('metadata-language-invalid', 'conflict', true,
                    entry.range.start, entry.range.end));
            }
            if (entry.value && spec.property === 'publishDate' && !validDate(entry.value)) {
                diagnostics.push(diagnostic('metadata-publish-date-invalid', 'conflict', true,
                    entry.range.start, entry.range.end));
            }
        });

        const customGroups = new Map();
        metadataEntries.filter(function (entry) { return entry.property === 'custom' && entry.customName; })
            .forEach(function (entry) {
                if (!customGroups.has(entry.customName)) customGroups.set(entry.customName, []);
                customGroups.get(entry.customName).push(entry);
            });
        customGroups.forEach(function (entries) {
            if (entries.length > 1) {
                entries.slice(1).forEach(function (entry) {
                    diagnostics.push(diagnostic('metadata-duplicate-custom', 'warning', true,
                        entry.range.start, entry.range.end));
                });
            } else customMetadata.push(entries[0]);
        });

        const parts = [];
        const chapterEntries = [];
        const orderItems = [];
        let currentPart = null;
        const exactPaths = new Map();
        const foldedPaths = new Map();
        for (let index = split + 1; index < lines.length; index++) {
            const line = lines[index];
            if (/^[ \t]*$/.test(line.text)) continue;
            const outer = trimHorizontal(line.text);
            const partMatch = /^Part[ \t]*:(.*)$/.exec(outer.text);
            if (partMatch) {
                const titleBits = trimHorizontal(partMatch[1]);
                currentPart = {
                    id: 'part@' + line.start + ':' + line.end,
                    type: 'part',
                    title: titleBits.text,
                    range: ranged(line.start, line.end),
                    chapters: []
                };
                parts.push(currentPart);
                orderItems.push(currentPart);
                if (!currentPart.title) diagnostics.push(diagnostic('part-empty', 'warning', false,
                    line.start, line.end));
                continue;
            }
            if (!outer.text.endsWith('.md')) {
                diagnostics.push(diagnostic('index-unknown-line', 'conflict', true, line.start, line.end));
                unknownLines.push({ type: 'unknown', block: 'ordered', range: ranged(line.start, line.end) });
                continue;
            }
            const chapterPath = outer.text;
            const entry = {
                id: 'chapter@' + line.start + ':' + line.end,
                type: 'chapter-entry',
                path: chapterPath,
                range: ranged(line.start, line.end),
                part: currentPart ? currentPart.title : null,
                valid: true,
                indexed: false
            };
            chapterEntries.push(entry);
            orderItems.push(entry);
            if (currentPart) currentPart.chapters.push(chapterPath);
            const unsafe = unsafePathCode(chapterPath);
            if (unsafe) {
                entry.valid = false;
                diagnostics.push(diagnostic(unsafe, 'conflict', true, line.start, line.end));
                continue;
            }
            if (exactPaths.has(chapterPath)) {
                entry.valid = false;
                diagnostics.push(diagnostic('chapter-path-duplicate', 'conflict', true, line.start, line.end));
                continue;
            }
            exactPaths.set(chapterPath, entry);
            entry.indexed = true;
            const normalized = chapterPath.normalize('NFC');
            const folded = normalized.toLowerCase();
            if (foldedPaths.has(folded)) {
                entry.valid = false;
                const prior = foldedPaths.get(folded).path;
                const code = prior !== chapterPath && prior.normalize('NFC') === normalized
                    ? 'chapter-path-unicode-collision' : 'chapter-path-case-collision';
                diagnostics.push(diagnostic(code, 'conflict', true, line.start, line.end));
                continue;
            }
            foldedPaths.set(folded, entry);
        }

        const orderedStart = split < lines.length ? lines[split].fullEnd : source.length;
        const orderedRange = ranged(orderedStart, source.length);
        const orderRange = orderItems.length
            ? ranged(orderItems[0].range.start, orderItems[orderItems.length - 1].range.end)
            : ranged(orderedStart, orderedStart);
        return deepFreeze({
            type: 'book-index',
            rangeUnit: 'utf16-code-unit',
            lineEnding: detectedLineEnding(lines),
            metadata: metadata,
            metadataEntries: metadataEntries,
            customMetadata: customMetadata,
            parts: parts,
            chapterEntries: chapterEntries,
            orderItems: orderItems,
            unknownLines: unknownLines,
            orderedRange: orderedRange,
            orderRange: orderRange,
            orderedSource: source.slice(orderedRange.start, orderedRange.end),
            diagnostics: diagnostics,
            exportBlocking: diagnostics.some(function (problem) { return problem.exportBlocking; })
        });
    }

    function result(ok, code, message, edits) {
        return deepFreeze({ ok: ok, code: code, message: message, edits: edits || [] });
    }

    function reorder(source, index, orderedIds) {
        if (typeof source !== 'string' || !index || index.type !== 'book-index' ||
            !Array.isArray(index.orderItems) || !index.orderedRange || typeof index.orderedSource !== 'string') {
            return result(false, 'index-order-invalid-input', 'Reorder needs source and its book-index model.');
        }
        if (index.diagnostics.some(function (problem) { return problem.code === 'source-too-large'; })) {
            return result(false, 'index-order-unreadable', 'The source exceeds the index reader limit.');
        }
        if (source.slice(index.orderedRange.start, index.orderedRange.end) !== index.orderedSource) {
            return result(false, 'index-order-stale-source', 'The ordered source changed after the index was read.');
        }
        if (!Array.isArray(orderedIds) || orderedIds.length !== index.orderItems.length) {
            return result(false, 'index-order-incomplete', 'Reorder needs every current part and chapter identity once.');
        }
        const byId = new Map(index.orderItems.map(function (item) { return [item.id, item]; }));
        const seen = new Set();
        const requested = [];
        for (const id of orderedIds) {
            if (typeof id !== 'string' || !byId.has(id) || seen.has(id)) {
                return result(false, 'index-order-invalid-identity', 'Reorder contains an unknown or repeated identity.');
            }
            seen.add(id);
            requested.push(byId.get(id));
        }
        if (!index.orderItems.length) return result(true, 'index-order-unchanged', 'The index has no ordered records.', []);
        const blocked = index.unknownLines.some(function (line) {
            return line.block === 'ordered' && line.range.start >= index.orderRange.start &&
                line.range.end <= index.orderRange.end;
        });
        if (blocked) {
            return result(false, 'index-order-unknown-line',
                'Resolve the unknown line inside the ordered records before reordering.');
        }
        const unchanged = requested.every(function (item, position) {
            return item.id === index.orderItems[position].id;
        });
        if (unchanged) return result(true, 'index-order-unchanged', 'The requested order already matches source.', []);

        let replacement = '';
        let cursor = index.orderRange.start;
        index.orderItems.forEach(function (slot, position) {
            replacement += source.slice(cursor, slot.range.start);
            const item = requested[position];
            replacement += source.slice(item.range.start, item.range.end);
            cursor = slot.range.end;
        });
        replacement += source.slice(cursor, index.orderRange.end);
        return result(true, 'index-order-ready', 'The order splice is ready.', [{
            start: index.orderRange.start,
            end: index.orderRange.end,
            text: replacement
        }]);
    }

    return {
        MAX_SOURCE_LENGTH: DEFAULT_MAX_SOURCE_LENGTH,
        read: read,
        reorder: reorder
    };
});
