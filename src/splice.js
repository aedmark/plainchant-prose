/*
 * Strict source-range splice application for Plainchant Prose (P1-03, D-002).
 * Ranges are zero-based, half-open UTF-16 code-unit offsets. Ambiguous edits are refused before source changes.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Splice = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function fail(ErrorType, code, message) {
        const problem = new ErrorType(message);
        problem.code = code;
        throw problem;
    }

    function validate(source, edits) {
        if (typeof source !== 'string') fail(TypeError, 'source-not-string', 'Splice source must be a string.');
        if (!Array.isArray(edits)) fail(TypeError, 'edits-not-array', 'Splice edits must be an array.');
        const ordered = edits.map(function (edit, index) {
            if (!edit || typeof edit !== 'object') {
                fail(TypeError, 'edit-not-object', 'Splice edit ' + index + ' must be an object.');
            }
            if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end)) {
                fail(TypeError, 'edit-range-not-integer', 'Splice edit ' + index + ' needs integer offsets.');
            }
            if (edit.start < 0 || edit.end < edit.start || edit.end > source.length) {
                fail(RangeError, 'edit-range-outside-source', 'Splice edit [' + edit.start + ', ' + edit.end +
                    ') is outside the source.');
            }
            if (typeof edit.text !== 'string') {
                fail(TypeError, 'edit-text-not-string', 'Splice edit ' + index + ' replacement must be a string.');
            }
            return { start: edit.start, end: edit.end, text: edit.text, index: index };
        }).sort(function (left, right) {
            return left.start - right.start || left.end - right.end || left.index - right.index;
        });

        let occupiedEnd = -1;
        let priorStart = -1;
        for (const current of ordered) {
            if (current.start === priorStart || current.start < occupiedEnd) {
                fail(RangeError, 'edit-ranges-overlap', 'Splice edits overlap or share an ambiguous start at offset ' +
                    current.start + '.');
            }
            priorStart = current.start;
            occupiedEnd = Math.max(occupiedEnd, current.end);
        }
        return ordered;
    }

    function apply(source, edits) {
        const ordered = validate(source, edits);
        let output = source;
        for (let index = ordered.length - 1; index >= 0; index--) {
            const edit = ordered[index];
            output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
        }
        return output;
    }

    return { apply: apply, validate: validate };
});
