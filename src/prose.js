/*
 * Pure Plainchant Prose source parser and safe preview renderer (P1-02, D-010, D-018).
 * Ranges are zero-based, half-open UTF-16 code-unit offsets so they can be passed directly to String.slice.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Prose = api;
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
    const ASCII_PUNCTUATION = /[!-/:-@\[-`{-~]/;

    function ranged(start, end) {
        return { start: start, end: end };
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

    function logicalEnd(source) {
        if (source.endsWith('\r\n')) return source.length - 2;
        if (source.endsWith('\n')) return source.length - 1;
        return source.length;
    }

    function makeDiagnostic(source, path, code, severity, exportBlocking, start, end) {
        const out = {
            code: code,
            severity: severity,
            path: path,
            exportBlocking: Boolean(exportBlocking)
        };
        if (Number.isInteger(start) && Number.isInteger(end)) {
            out.range = ranged(start, end);
        }
        return out;
    }

    function trimHorizontal(text) {
        let start = 0;
        let end = text.length;
        while (start < end && (text.charAt(start) === ' ' || text.charAt(start) === '\t')) start++;
        while (end > start && (text.charAt(end - 1) === ' ' || text.charAt(end - 1) === '\t')) end--;
        return { text: text.slice(start, end), start: start, end: end };
    }

    function isEscaped(source, at) {
        let slashes = 0;
        for (let i = at - 1; i >= 0 && source.charAt(i) === '\\'; i--) slashes++;
        return slashes % 2 === 1;
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
        return value;
    }

    function sourceLimitDiagnostic(source, path, options) {
        const requested = options && Number.isInteger(options.maxSourceLength) && options.maxSourceLength > 0
            ? options.maxSourceLength : DEFAULT_MAX_SOURCE_LENGTH;
        const limit = Math.min(DEFAULT_MAX_SOURCE_LENGTH, requested);
        if (source.length <= limit) return null;
        return makeDiagnostic(source, path, 'source-too-large', 'conflict', true, 0, Math.min(source.length, 1));
    }

    function parseMetadataLine(source, path, line, diagnostics) {
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
                diagnostics.push(makeDiagnostic(source, path, 'metadata-key-case', 'warning', false,
                    line.start, line.end));
            }
            return node;
        }
        if (key.toLowerCase() !== 'custom') return node;
        node.canonicalKey = 'Custom';
        node.property = 'custom';
        if (key !== 'Custom') {
            diagnostics.push(makeDiagnostic(source, path, 'metadata-key-case', 'warning', false,
                line.start, line.end));
        }
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

    function parseBook(files, options) {
        files = files && typeof files === 'object' ? files : {};
        const source = typeof files['book.txt'] === 'string' ? files['book.txt'] : '';
        const path = 'book.txt';
        const diagnostics = [];
        const limitProblem = sourceLimitDiagnostic(source, path, options);
        if (limitProblem) {
            diagnostics.push(limitProblem);
            return deepFreeze({
                type: 'book', rangeUnit: 'utf16-code-unit', lineEnding: '', metadata: {}, metadataEntries: [],
                customMetadata: [], parts: [], chapterEntries: [], chapters: [], diagnostics: diagnostics,
                exportBlocking: true
            });
        }
        if (!Object.prototype.hasOwnProperty.call(files, 'book.txt')) {
            diagnostics.push(makeDiagnostic(source, path, 'book-index-missing', 'conflict', true));
        }
        const lines = lineRecords(source);
        let split = lines.findIndex(function (line) { return /^[ \t]*$/.test(line.text); });
        if (split === -1) split = lines.length;
        const metadataEntries = [];
        for (let i = 0; i < split; i++) {
            const line = lines[i];
            const entry = parseMetadataLine(source, path, line, diagnostics);
            if (!entry) {
                diagnostics.push(makeDiagnostic(source, path, 'metadata-unknown-line', 'conflict', true,
                    line.start, line.end));
                continue;
            }
            if (!entry.canonicalKey) {
                diagnostics.push(makeDiagnostic(source, path, 'metadata-unknown-key', 'conflict', true,
                    line.start, line.end));
            } else if (entry.property === 'custom') {
                if (!entry.customName || !/^[A-Za-z0-9 _-]+$/.test(entry.customName)) {
                    diagnostics.push(makeDiagnostic(source, path, 'metadata-custom-invalid', 'conflict', true,
                        line.start, line.end));
                }
            }
            metadataEntries.push(entry);
        }

        const metadata = {};
        const customMetadata = [];
        Object.keys(STANDARD_KEYS).forEach(function (lookup) {
            const spec = STANDARD_KEYS[lookup];
            const entries = metadataEntries.filter(function (entry) { return entry.property === spec.property; });
            if (!entries.length) {
                if (spec.required) {
                    diagnostics.push(makeDiagnostic(source, path, 'metadata-required-missing', 'conflict', true));
                }
                return;
            }
            if (entries.length > 1) {
                entries.slice(1).forEach(function (entry) {
                    diagnostics.push(makeDiagnostic(source, path, duplicateCode(spec.property), 'warning', true,
                        entry.range.start, entry.range.end));
                });
                metadata[spec.property] = null;
                return;
            }
            const entry = entries[0];
            if (!entry.value && spec.required) {
                diagnostics.push(makeDiagnostic(source, path, 'metadata-required-empty', 'conflict', true,
                    entry.range.start, entry.range.end));
                metadata[spec.property] = null;
            } else {
                metadata[spec.property] = entry;
            }
            if (entry.value && spec.property === 'language' && !validLanguage(entry.value)) {
                diagnostics.push(makeDiagnostic(source, path, 'metadata-language-invalid', 'conflict', true,
                    entry.range.start, entry.range.end));
            }
            if (entry.value && spec.property === 'publishDate' && !validDate(entry.value)) {
                diagnostics.push(makeDiagnostic(source, path, 'metadata-publish-date-invalid', 'conflict', true,
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
                    diagnostics.push(makeDiagnostic(source, path, 'metadata-duplicate-custom', 'warning', true,
                        entry.range.start, entry.range.end));
                });
            } else customMetadata.push(entries[0]);
        });

        const parts = [];
        const chapterEntries = [];
        let currentPart = null;
        const exactPaths = new Map();
        const foldedPaths = new Map();
        for (let i = split + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/^[ \t]*$/.test(line.text)) continue;
            const outer = trimHorizontal(line.text);
            const partMatch = /^Part[ \t]*:(.*)$/.exec(outer.text);
            if (partMatch) {
                const titleBits = trimHorizontal(partMatch[1]);
                currentPart = {
                    type: 'part',
                    title: titleBits.text,
                    range: ranged(line.start, line.end),
                    chapters: []
                };
                parts.push(currentPart);
                if (!currentPart.title) {
                    diagnostics.push(makeDiagnostic(source, path, 'part-empty', 'warning', false,
                        line.start, line.end));
                }
                continue;
            }
            if (!outer.text.endsWith('.md')) {
                diagnostics.push(makeDiagnostic(source, path, 'index-unknown-line', 'conflict', true,
                    line.start, line.end));
                continue;
            }
            const chapterPath = outer.text;
            const entry = {
                type: 'chapter-entry',
                path: chapterPath,
                range: ranged(line.start, line.end),
                part: currentPart ? currentPart.title : null,
                valid: true
            };
            chapterEntries.push(entry);
            if (currentPart) currentPart.chapters.push(chapterPath);
            const unsafe = unsafePathCode(chapterPath);
            if (unsafe) {
                entry.valid = false;
                diagnostics.push(makeDiagnostic(source, path, unsafe, 'conflict', true, line.start, line.end));
                continue;
            }
            if (exactPaths.has(chapterPath)) {
                entry.valid = false;
                diagnostics.push(makeDiagnostic(source, path, 'chapter-path-duplicate', 'conflict', true,
                    line.start, line.end));
                continue;
            }
            exactPaths.set(chapterPath, entry);
            const normalized = chapterPath.normalize('NFC');
            const folded = normalized.toLowerCase();
            if (foldedPaths.has(folded)) {
                entry.valid = false;
                const prior = foldedPaths.get(folded).path;
                const code = prior !== chapterPath && prior.normalize('NFC') === normalized
                    ? 'chapter-path-unicode-collision' : 'chapter-path-case-collision';
                diagnostics.push(makeDiagnostic(source, path, code, 'conflict', true, line.start, line.end));
                continue;
            }
            foldedPaths.set(folded, entry);
        }

        const chapters = [];
        const parsedPaths = new Set();
        chapterEntries.forEach(function (entry) {
            if (!entry.valid || parsedPaths.has(entry.path)) return;
            parsedPaths.add(entry.path);
            if (!Object.prototype.hasOwnProperty.call(files, entry.path)) {
                diagnostics.push(makeDiagnostic(source, path, 'chapter-missing', 'conflict', true,
                    entry.range.start, entry.range.end));
                return;
            }
            if (typeof files[entry.path] !== 'string') {
                diagnostics.push(makeDiagnostic(source, path, 'chapter-unreadable', 'conflict', true,
                    entry.range.start, entry.range.end));
                return;
            }
            const chapter = parseChapter(files[entry.path], entry.path, options);
            chapters.push(chapter);
            chapter.diagnostics.forEach(function (problem) { diagnostics.push(problem); });
        });

        Object.keys(files).forEach(function (filePath) {
            if (filePath === 'book.txt' || !filePath.endsWith('.md')) return;
            if (filePath.split('/')[0].toLowerCase() === 'research') return;
            if (!exactPaths.has(filePath)) {
                diagnostics.push(makeDiagnostic('', filePath, 'chapter-unlisted', 'conflict', true));
            }
        });

        return deepFreeze({
            type: 'book',
            rangeUnit: 'utf16-code-unit',
            lineEnding: detectedLineEnding(lines),
            metadata: metadata,
            metadataEntries: metadataEntries,
            customMetadata: customMetadata,
            parts: parts,
            chapterEntries: chapterEntries,
            chapters: chapters,
            diagnostics: diagnostics,
            exportBlocking: diagnostics.some(function (problem) { return problem.exportBlocking; })
        });
    }

    function findFootnoteDefinitions(source, lines, path, diagnostics, concealed) {
        const definitions = [];
        const consumed = new Set();
        for (let i = 1; i < lines.length; i++) {
            if (consumed.has(i)) continue;
            if (hiddenAt(concealed || [], lines[i].start)) continue;
            const match = /^\[\^([^\]\s\x00-\x1f\x7f]+)\]:[ \t]?(.*)$/.exec(lines[i].text);
            if (!match) continue;
            const line = lines[i];
            const labelStart = line.start + 2;
            const contentStart = line.start + line.text.indexOf(':') + 1 +
                (/^[ \t]/.test(line.text.slice(line.text.indexOf(':') + 1)) ? 1 : 0);
            const segments = [{ start: contentStart, end: line.end }];
            let last = line;
            consumed.add(i);
            let next = i + 1;
            while (next < lines.length && /^(?: {4}|\t)/.test(lines[next].text)) {
                const prefix = lines[next].text.charAt(0) === '\t' ? 1 : 4;
                segments.push({ start: lines[next].start + prefix, end: lines[next].end });
                last = lines[next];
                consumed.add(next);
                next++;
            }
            const definition = {
                type: 'footnote-definition',
                label: match[1],
                labelRange: ranged(labelStart, labelStart + match[1].length),
                range: ranged(line.start, last.end),
                segments: segments,
                inlines: []
            };
            const body = segments.map(function (segment) { return source.slice(segment.start, segment.end); }).join('\n');
            const nested = /(\[\[|\/\*|\[\^[^\]]+\])/.exec(body);
            if (nested) {
                const bodyOffset = source.indexOf(nested[0], contentStart);
                diagnostics.push(makeDiagnostic(source, path, 'footnote-definition-unsupported', 'warning', false,
                    bodyOffset, bodyOffset + nested[0].length));
            }
            definitions.push(definition);
            i = next - 1;
        }
        return { definitions: definitions, consumed: consumed };
    }

    function hiddenAt(hidden, at) {
        for (const node of hidden) {
            if (at >= node.range.start && at < node.range.end) return node;
            if (node.range.start > at) break;
        }
        return null;
    }

    function scanHidden(source, start, end, path, excluded, diagnostics) {
        const notes = [];
        const boneyards = [];
        let i = start;
        while (i < end) {
            const excludedNode = hiddenAt(excluded, i);
            if (excludedNode) {
                i = excludedNode.range.end;
                continue;
            }
            if (source.charAt(i) === '\\' && i + 1 < end && ASCII_PUNCTUATION.test(source.charAt(i + 1))) {
                if (source.slice(i + 1, i + 3) === '[[') {
                    const literalClose = source.indexOf(']]', i + 3);
                    if (literalClose !== -1) {
                        i = literalClose + 2;
                        continue;
                    }
                }
                i += 2;
                continue;
            }
            const opener = source.slice(i, i + 2);
            if (opener === '[[' || opener === '/*') {
                const closer = opener === '[[' ? ']]' : '*/';
                let close = i + 2;
                while (close < end) {
                    const excludedClose = hiddenAt(excluded, close);
                    if (excludedClose) {
                        close = excludedClose.range.end;
                        continue;
                    }
                    if (source.slice(close, close + 2) === closer && !isEscaped(source, close)) break;
                    close++;
                }
                if (close >= end) {
                    const finish = logicalEnd(source);
                    diagnostics.push(makeDiagnostic(source, path,
                        opener === '[[' ? 'note-unclosed' : 'boneyard-unclosed', 'warning', true, i, finish));
                    i += 2;
                    continue;
                }
                const node = {
                    type: opener === '[[' ? 'note' : 'boneyard',
                    range: ranged(i, close + 2),
                    contentRange: ranged(i + 2, close),
                    text: source.slice(i + 2, close)
                };
                (opener === '[[' ? notes : boneyards).push(node);
                i = close + 2;
                continue;
            }
            if ((opener === ']]' || opener === '*/') && !isEscaped(source, i)) {
                diagnostics.push(makeDiagnostic(source, path,
                    opener === ']]' ? 'note-stray-close' : 'boneyard-stray-close', 'warning', false, i, i + 2));
                i += 2;
                continue;
            }
            i++;
        }
        return { notes: notes, boneyards: boneyards };
    }

    function nextUnescaped(source, token, start, end, singleStar) {
        let at = source.indexOf(token, start);
        while (at !== -1 && at < end) {
            const validStar = !singleStar || (source.charAt(at - 1) !== '*' && source.charAt(at + 1) !== '*');
            if (!isEscaped(source, at) && validStar && !/\s/.test(source.charAt(at - 1))) return at;
            at = source.indexOf(token, at + 1);
        }
        return -1;
    }

    function mergeTextNodes(nodes) {
        const out = [];
        nodes.forEach(function (node) {
            const prior = out[out.length - 1];
            if (prior && prior.type === 'text' && node.type === 'text' && prior.range.end === node.range.start &&
                !prior.escaped && !node.escaped) {
                prior.text += node.text;
                prior.range.end = node.range.end;
            } else out.push(node);
        });
        return out;
    }

    function parseInlines(source, start, end, hidden, references, allowFootnotes) {
        const nodes = [];
        let i = start;
        while (i < end) {
            const concealed = hiddenAt(hidden, i);
            if (concealed) {
                i = Math.min(end, concealed.range.end);
                continue;
            }
            const char = source.charAt(i);
            if (char === '\\' && i + 1 < end && ASCII_PUNCTUATION.test(source.charAt(i + 1))) {
                nodes.push({ type: 'text', text: source.charAt(i + 1), range: ranged(i, i + 2), escaped: true });
                i += 2;
                continue;
            }
            if (allowFootnotes && source.slice(i, i + 2) === '[^') {
                const match = /^\[\^([^\]\s\x00-\x1f\x7f]+)\]/.exec(source.slice(i, end));
                if (match) {
                    const node = { type: 'footnote-reference', label: match[1], range: ranged(i, i + match[0].length) };
                    nodes.push(node);
                    references.push(node);
                    i += match[0].length;
                    continue;
                }
            }
            if (source.slice(i, i + 3) === '***') {
                const combinedClose = source.indexOf('***', i + 3);
                const combinedEnd = combinedClose !== -1 && combinedClose < end ? combinedClose + 3 : i + 3;
                nodes.push({
                    type: 'text',
                    text: source.slice(i, combinedEnd),
                    range: ranged(i, combinedEnd),
                    escaped: false
                });
                i = combinedEnd;
                continue;
            }
            if (source.slice(i, i + 3) !== '***' && source.slice(i, i + 2) === '**' &&
                i + 2 < end && !/\s/.test(source.charAt(i + 2))) {
                const close = nextUnescaped(source, '**', i + 2, end, false);
                if (close !== -1) {
                    nodes.push({
                        type: 'bold',
                        range: ranged(i, close + 2),
                        children: parseInlines(source, i + 2, close, hidden, references, allowFootnotes)
                    });
                    i = close + 2;
                    continue;
                }
            }
            if (char === '*' && source.slice(i, i + 2) !== '**' && i + 1 < end &&
                !/\s/.test(source.charAt(i + 1))) {
                const close = nextUnescaped(source, '*', i + 1, end, true);
                if (close !== -1) {
                    nodes.push({
                        type: 'italic',
                        range: ranged(i, close + 1),
                        children: parseInlines(source, i + 1, close, hidden, references, allowFootnotes)
                    });
                    i = close + 1;
                    continue;
                }
            }
            nodes.push({ type: 'text', text: char, range: ranged(i, i + 1), escaped: false });
            i++;
        }
        return mergeTextNodes(nodes);
    }

    function lineWithoutHidden(line, hidden) {
        const characters = line.text.split('');
        hidden.forEach(function (node) {
            const start = Math.max(line.start, node.range.start) - line.start;
            const end = Math.min(line.end, node.range.end) - line.start;
            for (let i = Math.max(0, start); i < Math.max(0, end); i++) characters[i] = ' ';
        });
        return characters.join('');
    }

    function lineIsBlankDelimiter(line, hidden) {
        return /^[ \t]*$/.test(line.text) && !hiddenAt(hidden, line.start);
    }

    function unsupportedLineDiagnostics(source, path, line, hidden, diagnostics) {
        const text = lineWithoutHidden(line, hidden);
        let match = /\*\*\*[^*\n]+\*\*\*/.exec(text);
        if (match) diagnostics.push(makeDiagnostic(source, path, 'inline-unsupported', 'warning', false,
            line.start + match.index, line.start + match.index + match[0].length));
        if (/\S {2,}$/.test(line.text) && !hiddenAt(hidden, Math.max(line.start, line.end - 1))) {
            diagnostics.push(makeDiagnostic(source, path, 'inline-unsupported-hard-break', 'warning', false,
                line.start, line.end));
        }
        if (/^#{2,6}(?:[^#]|$)/.test(text) && !/^(#{2,6}) +(.+?) *$/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'heading-malformed', 'warning', false,
                line.start, line.end));
        } else if (/^#{7,}(?:[ \t]|$)/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'heading-unsupported', 'warning', false,
                line.start, line.end));
        }
        if (/^[ \t]*(?:[-+*]|\d+\.)[ \t]+/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'block-unsupported-list', 'warning', false,
                line.start, line.end));
        } else if (/^[ \t]*<[^>]+>/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'block-unsupported-html', 'warning', false,
                line.start, line.end));
        } else if (/^[ \t]*(?:---+|___+|\*\*\*+)[ \t]*$/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'block-unsupported-rule', 'warning', false,
                line.start, line.end));
        } else if (/^[ \t]*```/.test(text) || /^(?: {4}|\t)\S/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'block-unsupported-code', 'warning', false,
                line.start, line.end));
        } else if (/!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|\[[^\]]+\]\[[^\]]*\]/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'inline-unsupported-link', 'warning', false,
                line.start, line.end));
        } else if (/\|/.test(text)) {
            diagnostics.push(makeDiagnostic(source, path, 'block-unsupported-table', 'warning', false,
                line.start, line.end));
        }
    }

    function parseChapter(source, path, options) {
        source = typeof source === 'string' ? source : '';
        path = path || 'chapter.md';
        const diagnostics = [];
        const limitProblem = sourceLimitDiagnostic(source, path, options);
        if (limitProblem) {
            diagnostics.push(limitProblem);
            return deepFreeze({
                type: 'chapter', path: path, rangeUnit: 'utf16-code-unit', lineEnding: '', title: null,
                blocks: [], scenes: [], notes: [], boneyards: [], footnotes: { references: [], definitions: [] },
                diagnostics: diagnostics, exportBlocking: true
            });
        }
        const lines = lineRecords(source);
        const bom = source.charAt(0) === '\uFEFF';
        if (bom) diagnostics.push(makeDiagnostic(source, path, 'source-bom', 'warning', false, 0, 1));
        const firstText = bom ? lines[0].text.slice(1) : lines[0].text;
        const firstStart = lines[0].start + (bom ? 1 : 0);
        const titleMatch = /^# +(.+?) *$/.exec(firstText);
        let title = null;
        if (titleMatch) {
            const contentOffset = firstText.indexOf(titleMatch[1]);
            title = {
                type: 'title',
                text: titleMatch[1],
                range: ranged(firstStart, lines[0].end),
                contentRange: ranged(firstStart + contentOffset, firstStart + contentOffset + titleMatch[1].length),
                inlines: []
            };
        } else {
            diagnostics.push(makeDiagnostic(source, path,
                /^# +[ \t]*$/.test(firstText) ? 'chapter-title-empty' : 'chapter-title-missing',
                'conflict', true, firstStart, lines[0].end));
        }
        const preliminary = scanHidden(source, lines[0].fullEnd, source.length, path, [], []);
        const preliminaryHidden = preliminary.notes.concat(preliminary.boneyards)
            .sort(function (a, b) { return a.range.start - b.range.start; });
        const footnoteScan = findFootnoteDefinitions(source, lines, path, diagnostics, preliminaryHidden);
        const excluded = footnoteScan.definitions.map(function (definition) {
            return { range: definition.range };
        }).sort(function (a, b) { return a.range.start - b.range.start; });
        const hiddenScan = scanHidden(source, lines[0].fullEnd, source.length, path, excluded, diagnostics);
        const hidden = hiddenScan.notes.concat(hiddenScan.boneyards)
            .sort(function (a, b) { return a.range.start - b.range.start; });
        for (let i = 1; i < lines.length; i++) {
            if (/^# +/.test(lineWithoutHidden(lines[i], hidden))) {
                diagnostics.push(makeDiagnostic(source, path, 'chapter-title-additional', 'conflict', true,
                    lines[i].start, lines[i].end));
            }
        }
        const references = [];
        if (title) title.inlines = parseInlines(source, title.contentRange.start, title.contentRange.end,
            hidden, references, false);

        const blocks = [];
        if (title) blocks.push(title);
        const scenes = [{
            type: 'scene',
            range: ranged(lines[0].fullEnd, source.length),
            breakRange: null,
            synopsis: null,
            blocks: [],
            hasPrintableContent: false
        }];
        let scene = scenes[0];
        let expectedSynopsisLine = 1;

        function addBlock(block, printable) {
            blocks.push(block);
            scene.blocks.push(block);
            if (printable) scene.hasPrintableContent = true;
        }

        for (let i = 1; i < lines.length;) {
            const line = lines[i];
            const visibleText = lineWithoutHidden(line, hidden);
            if (footnoteScan.consumed.has(i)) {
                if (i === expectedSynopsisLine) expectedSynopsisLine = null;
                i++;
                continue;
            }
            if (lineIsBlankDelimiter(line, hidden)) {
                if (i === expectedSynopsisLine) expectedSynopsisLine = null;
                i++;
                continue;
            }
            if (/^[ \t]*\* \* \*[ \t]*$/.test(visibleText)) {
                scene.range.end = line.start;
                const breakBlock = { type: 'scene-break', range: ranged(line.start, line.end) };
                scene = {
                    type: 'scene',
                    range: ranged(line.start, source.length),
                    breakRange: ranged(line.start, line.end),
                    synopsis: null,
                    blocks: [breakBlock],
                    hasPrintableContent: false
                };
                scenes.push(scene);
                blocks.push(breakBlock);
                expectedSynopsisLine = i + 1;
                i++;
                continue;
            }
            if (visibleText === '=' || visibleText.startsWith('= ')) {
                const synopsisText = visibleText === '=' ? '' : visibleText.slice(2);
                if (i === expectedSynopsisLine && synopsisText) {
                    scene.synopsis = {
                        type: 'synopsis',
                        text: synopsisText,
                        range: ranged(line.start, line.end),
                        contentRange: ranged(line.start + 2, line.end)
                    };
                    expectedSynopsisLine = null;
                    i++;
                    continue;
                }
                const code = !synopsisText ? 'synopsis-empty' : (scene.synopsis ? 'synopsis-duplicate' : 'synopsis-misplaced');
                diagnostics.push(makeDiagnostic(source, path, code, 'warning', false, line.start, line.end));
                addBlock({
                    type: 'paragraph',
                    range: ranged(line.start, line.end),
                    lines: [{
                        range: ranged(line.start, line.end),
                        inlines: parseInlines(source, line.start, line.end, hidden, references, true)
                    }]
                }, true);
                expectedSynopsisLine = null;
                i++;
                continue;
            }
            expectedSynopsisLine = null;

            const heading = /^(#{2,6}) +(.+?) *$/.exec(visibleText);
            if (heading) {
                const contentStart = line.start + visibleText.indexOf(heading[2]);
                if (/\[\^[^\]]+\]/.test(heading[2])) {
                    diagnostics.push(makeDiagnostic(source, path, 'heading-footnote-unsupported', 'warning', false,
                        line.start, line.end));
                }
                const block = {
                    type: 'heading',
                    level: heading[1].length,
                    text: heading[2],
                    range: ranged(line.start, line.end),
                    contentRange: ranged(contentStart, contentStart + heading[2].length),
                    inlines: parseInlines(source, contentStart, contentStart + heading[2].length,
                        hidden, references, false)
                };
                addBlock(block, true);
                i++;
                continue;
            }
            if (visibleText.startsWith('> ') && visibleText.length > 2 && !visibleText.startsWith('> >')) {
                const quoteLines = [];
                const start = line.start;
                let end = line.end;
                while (i < lines.length) {
                    const quoteText = lineWithoutHidden(lines[i], hidden);
                    if (!quoteText.startsWith('> ') || quoteText.length <= 2 || quoteText.startsWith('> >')) break;
                    const contentStart = lines[i].start + 2;
                    quoteLines.push({
                        range: ranged(lines[i].start, lines[i].end),
                        inlines: parseInlines(source, contentStart, lines[i].end, hidden, references, true)
                    });
                    end = lines[i].end;
                    i++;
                }
                addBlock({ type: 'quote', range: ranged(start, end), lines: quoteLines }, true);
                continue;
            }
            if (visibleText === '>' || visibleText === '> ' || visibleText.startsWith('>>') ||
                visibleText.startsWith('> >')) {
                diagnostics.push(makeDiagnostic(source, path,
                    visibleText === '>' || visibleText === '> ' ? 'quote-empty' : 'quote-nested',
                    'warning', false, line.start, line.end));
                addBlock({
                    type: 'paragraph',
                    range: ranged(line.start, line.end),
                    lines: [{
                        range: ranged(line.start, line.end),
                        inlines: parseInlines(source, line.start, line.end, hidden, references, true)
                    }]
                }, true);
                i++;
                continue;
            }

            const paragraphLines = [];
            const paragraphStart = line.start;
            let paragraphEnd = line.end;
            while (i < lines.length) {
                const candidate = lines[i];
                const candidateText = lineWithoutHidden(candidate, hidden);
                if (footnoteScan.consumed.has(i) || lineIsBlankDelimiter(candidate, hidden) ||
                    /^[ \t]*\* \* \*[ \t]*$/.test(candidateText) || /^(#{2,6}) +(.+?) *$/.test(candidateText) ||
                    candidateText.startsWith('> ') || candidateText === '>' || candidateText.startsWith('>>') ||
                    candidateText === '=' || candidateText.startsWith('= ')) break;
                unsupportedLineDiagnostics(source, path, candidate, hidden, diagnostics);
                paragraphLines.push({
                    range: ranged(candidate.start, candidate.end),
                    inlines: parseInlines(source, candidate.start, candidate.end, hidden, references, true)
                });
                paragraphEnd = candidate.end;
                i++;
            }
            if (!paragraphLines.length) {
                i++;
                continue;
            }
            addBlock({ type: 'paragraph', range: ranged(paragraphStart, paragraphEnd), lines: paragraphLines }, true);
        }

        if (scene.breakRange && !scene.synopsis && !scene.hasPrintableContent) {
            diagnostics.push(makeDiagnostic(source, path, 'scene-empty', 'warning', false,
                scene.breakRange.start, scene.breakRange.end));
        }

        footnoteScan.definitions.forEach(function (definition) {
            definition.inlines = definition.segments.map(function (segment) {
                return parseInlines(source, segment.start, segment.end, [], [], false);
            });
        });
        const definitionGroups = new Map();
        footnoteScan.definitions.forEach(function (definition) {
            if (!definitionGroups.has(definition.label)) definitionGroups.set(definition.label, []);
            definitionGroups.get(definition.label).push(definition);
        });
        const referenceGroups = new Map();
        references.forEach(function (reference) {
            if (!referenceGroups.has(reference.label)) referenceGroups.set(reference.label, []);
            referenceGroups.get(reference.label).push(reference);
        });
        referenceGroups.forEach(function (items, label) {
            if (items.length > 1) {
                items.slice(1).forEach(function (item) {
                    diagnostics.push(makeDiagnostic(source, path, 'footnote-reference-duplicate', 'conflict', true,
                        item.range.start, item.range.end));
                });
            }
            if (!definitionGroups.has(label)) {
                diagnostics.push(makeDiagnostic(source, path, 'footnote-definition-missing', 'conflict', true,
                    items[0].range.start, items[0].range.end));
            }
        });
        definitionGroups.forEach(function (items, label) {
            if (items.length > 1) {
                items.slice(1).forEach(function (item) {
                    diagnostics.push(makeDiagnostic(source, path, 'footnote-definition-duplicate', 'conflict', true,
                        item.range.start, item.range.end));
                });
            }
            if (!referenceGroups.has(label)) {
                diagnostics.push(makeDiagnostic(source, path, 'footnote-definition-unused', 'warning', false,
                    items[0].range.start, items[0].range.end));
            }
        });

        scenes.forEach(function (item) { delete item.hasPrintableContent; });
        return deepFreeze({
            type: 'chapter',
            path: path,
            rangeUnit: 'utf16-code-unit',
            lineEnding: detectedLineEnding(lines),
            title: title,
            blocks: blocks,
            scenes: scenes,
            notes: hiddenScan.notes,
            boneyards: hiddenScan.boneyards,
            footnotes: { references: references, definitions: footnoteScan.definitions },
            diagnostics: diagnostics,
            exportBlocking: diagnostics.some(function (problem) { return problem.exportBlocking; })
        });
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderInlines(nodes, validFootnotes) {
        return nodes.map(function (node) {
            if (node.type === 'text') return escapeHtml(node.text);
            if (node.type === 'bold') return '<strong>' + renderInlines(node.children, validFootnotes) + '</strong>';
            if (node.type === 'italic') return '<em>' + renderInlines(node.children, validFootnotes) + '</em>';
            if (node.type === 'footnote-reference') {
                if (!validFootnotes || !validFootnotes.has(node.label)) return escapeHtml('[^' + node.label + ']');
                const label = escapeHtml(node.label);
                return '<sup><a href="#note-' + label + '" role="doc-noteref">' + label + '</a></sup>';
            }
            return '';
        }).join('');
    }

    function gapIsConcealed(hidden, start, end) {
        let cursor = start;
        for (const node of hidden) {
            if (node.range.end <= cursor) continue;
            if (node.range.start > cursor) return false;
            cursor = Math.max(cursor, node.range.end);
            if (cursor >= end) return true;
        }
        return cursor >= end;
    }

    function renderLineRuns(lines, hidden, validFootnotes) {
        let html = '';
        let lastEnd = null;
        lines.forEach(function (line) {
            if (!line.inlines.length) return;
            const firstStart = line.inlines[0].range.start;
            if (lastEnd !== null && !gapIsConcealed(hidden, lastEnd, firstStart)) html += ' ';
            html += renderInlines(line.inlines, validFootnotes);
            lastEnd = line.inlines[line.inlines.length - 1].range.end;
        });
        return html;
    }

    function toHTML(chapter) {
        if (!chapter || chapter.type !== 'chapter') return '';
        const html = [];
        const hidden = chapter.notes.concat(chapter.boneyards)
            .sort(function (a, b) { return a.range.start - b.range.start; });
        const referenceCounts = new Map();
        const definitionCounts = new Map();
        chapter.footnotes.references.forEach(function (reference) {
            referenceCounts.set(reference.label, (referenceCounts.get(reference.label) || 0) + 1);
        });
        chapter.footnotes.definitions.forEach(function (definition) {
            definitionCounts.set(definition.label, (definitionCounts.get(definition.label) || 0) + 1);
        });
        const validFootnotes = new Set();
        referenceCounts.forEach(function (count, label) {
            if (count === 1 && definitionCounts.get(label) === 1) validFootnotes.add(label);
        });
        chapter.blocks.forEach(function (block) {
            if (block.type === 'title') html.push('<h1>' + renderInlines(block.inlines, validFootnotes) + '</h1>');
            else if (block.type === 'heading') {
                html.push('<h' + block.level + '>' + renderInlines(block.inlines, validFootnotes) + '</h' + block.level + '>');
            } else if (block.type === 'paragraph') {
                html.push('<p>' + renderLineRuns(block.lines, hidden, validFootnotes) + '</p>');
            }
            else if (block.type === 'quote') {
                html.push('<blockquote><p>' + renderLineRuns(block.lines, hidden, validFootnotes) + '</p></blockquote>');
            } else if (block.type === 'scene-break') html.push('<hr>');
        });
        const definitions = chapter.footnotes.definitions.filter(function (definition, index, all) {
            return validFootnotes.has(definition.label) && all.findIndex(function (candidate) {
                return candidate.label === definition.label;
            }) === index;
        });
        if (definitions.length) {
            html.push('<section class="endnotes" role="doc-endnotes"><ol>');
            definitions.forEach(function (definition) {
                html.push('<li id="note-' + escapeHtml(definition.label) + '">' +
                    definition.inlines.map(function (inlines) {
                        return renderInlines(inlines, validFootnotes);
                    }).join(' ') + '</li>');
            });
            html.push('</ol></section>');
        }
        return html.join('');
    }

    function parse(input, pathOrOptions, maybeOptions) {
        if (typeof input === 'string') {
            return parseChapter(input, typeof pathOrOptions === 'string' ? pathOrOptions : 'chapter.md',
                typeof pathOrOptions === 'object' ? pathOrOptions : maybeOptions);
        }
        return parseBook(input, pathOrOptions);
    }

    return {
        MAX_SOURCE_LENGTH: DEFAULT_MAX_SOURCE_LENGTH,
        parse: parse,
        parseBook: parseBook,
        parseChapter: parseChapter,
        toHTML: toHTML,
        escapeHtml: escapeHtml
    };
});
