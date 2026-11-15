/* Pure folder-synchronization decisions for Plainchant Prose (P1-06, D-022). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.FileSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CONFLICT_CHOICES = Object.freeze(['use-disk', 'keep-prose', 'export-elsewhere', 'compare']);

    function canonicalText(value) {
        return String(value == null ? '' : value).replace(/\r\n?|\n/g, '\n');
    }

    function newlineStyle(value) {
        const text = String(value == null ? '' : value);
        const match = /\r\n|\r|\n/.exec(text);
        return match ? match[0] : '\n';
    }

    function diskText(value, previous) {
        return canonicalText(value).replace(/\n/g, newlineStyle(previous));
    }

    function validFingerprint(value) {
        return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
    }

    function validPath(value) {
        if (typeof value !== 'string' || !value || value.length > 1024 || value.indexOf('\\') !== -1 ||
            value.startsWith('/') || /^[A-Za-z]:/.test(value) || /[\x00-\x1f\x7f]/.test(value)) return false;
        return !value.split('/').some(function (part) { return !part || part === '.' || part === '..'; });
    }

    function validateEntry(entry) {
        if (!entry || !validPath(entry.path) || !['text', 'binary'].includes(entry.kind) ||
            !validFingerprint(entry.exact)) return false;
        return entry.kind === 'binary' ? entry.canonical === entry.exact : validFingerprint(entry.canonical);
    }

    function mapSnapshot(snapshot, label) {
        const map = new Map();
        (snapshot || []).forEach(function (entry) {
            if (!validateEntry(entry)) throw new Error(label + ' contains an invalid fingerprint entry.');
            if (map.has(entry.path)) throw new Error(label + ' contains a duplicate path.');
            map.set(entry.path, entry);
        });
        return map;
    }

    function sameContent(left, right) {
        if (!left || !right || left.kind !== right.kind) return false;
        return left.kind === 'text' ? left.canonical === right.canonical : left.exact === right.exact;
    }

    function sameExact(left, right) {
        return Boolean(left && right && left.kind === right.kind && left.exact === right.exact);
    }

    function collisionKey(path) { return path.normalize('NFC').toLowerCase(); }

    function pathCollisions(paths) {
        const seen = new Map();
        const out = [];
        Array.from(paths || []).sort().forEach(function (path) {
            const key = collisionKey(path);
            if (seen.has(key) && seen.get(key) !== path) out.push(Object.freeze({ first: seen.get(key), second: path }));
            else seen.set(key, path);
        });
        return Object.freeze(out);
    }

    function renameEvidence(baseline, disk) {
        const removed = Array.from(baseline.values()).filter(function (entry) { return !disk.has(entry.path); });
        const added = Array.from(disk.values()).filter(function (entry) { return !baseline.has(entry.path); });
        const candidates = [];
        removed.forEach(function (before) {
            added.forEach(function (after) {
                if (sameExact(before, after)) candidates.push({ from: before.path, to: after.path, exact: before.exact });
            });
        });
        const counts = new Map();
        candidates.forEach(function (item) {
            counts.set('from:' + item.from, (counts.get('from:' + item.from) || 0) + 1);
            counts.set('to:' + item.to, (counts.get('to:' + item.to) || 0) + 1);
        });
        return Object.freeze({
            suggestions: Object.freeze(candidates.filter(function (item) {
                return counts.get('from:' + item.from) === 1 && counts.get('to:' + item.to) === 1;
            }).map(Object.freeze)),
            ambiguous: Object.freeze(candidates.filter(function (item) {
                return counts.get('from:' + item.from) !== 1 || counts.get('to:' + item.to) !== 1;
            }).map(Object.freeze))
        });
    }

    function issue(code, path, details) {
        return Object.freeze(Object.assign({ code: code, path: path, choices: CONFLICT_CHOICES }, details || {}));
    }

    function plan(input) {
        const state = input || {};
        const baseline = mapSnapshot(state.baseline, 'The last-synced snapshot');
        const local = mapSnapshot(state.local, 'The working-copy snapshot');
        const disk = mapSnapshot(state.disk, 'The folder snapshot');
        const explicitDeletes = new Set(state.explicitDeletes || []);
        const actions = [], conflicts = [], choices = [];
        const collisions = pathCollisions(Array.from(disk.keys()).concat(Array.from(local.keys())));
        collisions.forEach(function (pair) {
            conflicts.push(issue('path-collision', pair.first, { otherPath: pair.second }));
        });

        const paths = new Set(Array.from(baseline.keys()).concat(Array.from(local.keys()), Array.from(disk.keys())));
        Array.from(paths).sort().forEach(function (path) {
            const before = baseline.get(path) || null;
            const here = local.get(path) || null;
            const there = disk.get(path) || null;

            if (!before) {
                if (here && there) {
                    if (sameContent(here, there)) actions.push({ type: 'track', path: path, expectedExact: there.exact });
                    else conflicts.push(issue('addition-collision', path));
                } else if (here) actions.push({ type: 'write', path: path, expectedExact: null });
                else if (there) choices.push(issue('disk-addition', path, { choices: Object.freeze(['import', 'ignore']) }));
                return;
            }

            if (!here && !there) {
                actions.push({ type: 'track-missing', path: path, expectedExact: null });
                return;
            }
            if (!here) {
                if (!explicitDeletes.has(path)) {
                    conflicts.push(issue('local-missing-without-deletion', path));
                } else if (sameExact(before, there)) {
                    choices.push(issue('confirm-disk-delete', path, { choices: Object.freeze(['delete', 'keep-disk']) }));
                } else conflicts.push(issue('delete-versus-disk-change', path));
                return;
            }
            if (!there) {
                conflicts.push(issue(sameContent(here, before) ? 'disk-deleted' : 'disk-deleted-and-local-changed', path,
                    { choices: Object.freeze(['restore', 'accept-disk-delete', 'compare']) }));
                return;
            }

            const localChanged = !sameContent(here, before);
            const diskChanged = !sameContent(there, before);
            if (!localChanged && !diskChanged) {
                actions.push({ type: 'track', path: path, expectedExact: there.exact });
            } else if (localChanged && !diskChanged) {
                actions.push({ type: 'write', path: path, expectedExact: there.exact });
            } else if (!localChanged && diskChanged) {
                actions.push({ type: 'load', path: path, expectedExact: there.exact });
            } else if (sameContent(here, there)) {
                actions.push({ type: 'track', path: path, expectedExact: there.exact });
            } else conflicts.push(issue('simultaneous-change', path));
        });

        const renames = renameEvidence(baseline, disk);
        renames.ambiguous.forEach(function (item) {
            conflicts.push(issue('rename-ambiguous', item.from, { otherPath: item.to }));
        });
        const blocked = conflicts.length > 0 || choices.length > 0;
        return Object.freeze({
            status: blocked ? 'paused' : (actions.some(function (action) { return action.type !== 'track'; }) ? 'ready' : 'synchronized'),
            blocked: blocked,
            actions: Object.freeze(actions.map(Object.freeze)),
            conflicts: Object.freeze(conflicts),
            choices: Object.freeze(choices),
            renames: renames.suggestions
        });
    }

    function preflight(expectedExact, observed) {
        const actual = observed ? observed.exact : null;
        return Object.freeze(actual === expectedExact
            ? { ok: true, code: 'fingerprint-match' }
            : { ok: false, code: 'folder-changed-before-write', expectedExact: expectedExact, actualExact: actual });
    }

    // Retained generic Studio callers use this until P2-01 removes the inherited shell.
    function dirtyPaths(entries, saved) {
        const base = saved || {};
        return Object.keys(entries || {}).filter(function (path) { return entries[path] !== base[path]; });
    }

    return Object.freeze({
        canonicalText: canonicalText, canon: canonicalText, newlineStyle: newlineStyle, diskText: diskText,
        validFingerprint: validFingerprint, validPath: validPath, validateEntry: validateEntry,
        sameContent: sameContent, sameExact: sameExact, pathCollisions: pathCollisions,
        renameEvidence: renameEvidence, plan: plan, preflight: preflight, dirtyPaths: dirtyPaths,
        CONFLICT_CHOICES: CONFLICT_CHOICES
    });
});
