function syncFingerprint(mark) {
    return 'sha256:' + String(mark).repeat(64).slice(0, 64);
}

function syncEntry(path, canonical, exact, kind) {
    const type = kind || 'text';
    return { path: path, kind: type, canonical: syncFingerprint(canonical), exact: syncFingerprint(exact || canonical) };
}

function syncPlan(before, local, disk, extra) {
    return FileSync.plan(Object.assign({ baseline: before, local: local, disk: disk }, extra || {}));
}

test('file sync: canonical comparison changes only newline encoding and preserves every other character', () => {
    assert.equal(FileSync.canonicalText('\ufeffa\r\n\r\n'), '\ufeffa\n\n');
    assert.equal(FileSync.canonicalText(''), '');
    assert.equal(FileSync.canonicalText('a\n\n'), 'a\n\n');
    assert.equal(FileSync.diskText('a\n\n', 'old\r\ntext\r\n'), 'a\r\n\r\n');
    assert.equal(FileSync.diskText('a\n', 'one line'), 'a\n');
});

test('file sync: the three-way matrix distinguishes local, disk, equal, and simultaneous changes', () => {
    const base = [syncEntry('one.md', 'a')];
    let result = syncPlan(base, base, base);
    assert.equal(result.status, 'synchronized');
    assert.equal(result.actions[0].type, 'track');

    result = syncPlan(base, [syncEntry('one.md', 'b')], base);
    assert.equal(result.status, 'ready');
    assert.equal(result.actions[0].type, 'write');
    assert.equal(result.actions[0].expectedExact, syncFingerprint('a'));

    result = syncPlan(base, base, [syncEntry('one.md', 'b')]);
    assert.equal(result.actions[0].type, 'load');

    result = syncPlan(base, [syncEntry('one.md', 'b')], [syncEntry('one.md', 'b', 'c')]);
    assert.equal(result.actions[0].type, 'track', 'canonical equality avoids a newline-only write');

    result = syncPlan(base, [syncEntry('one.md', 'b')], [syncEntry('one.md', 'c')]);
    assert.equal(result.status, 'paused');
    assert.equal(result.conflicts[0].code, 'simultaneous-change');
});

test('file sync: additions, missing files, and confirmed deletion stay explicit', () => {
    let result = syncPlan([], [syncEntry('new.md', 'a')], []);
    assert.equal(result.actions[0].type, 'write');
    assert.equal(result.actions[0].expectedExact, null);

    result = syncPlan([], [], [syncEntry('outside.md', 'a')]);
    assert.equal(result.status, 'paused');
    assert.equal(result.choices[0].code, 'disk-addition');

    const base = [syncEntry('one.md', 'a')];
    result = syncPlan(base, [], base);
    assert.equal(result.conflicts[0].code, 'local-missing-without-deletion');

    result = syncPlan(base, [], base, { explicitDeletes: ['one.md'] });
    assert.equal(result.choices[0].code, 'confirm-disk-delete');

    result = syncPlan(base, base, []);
    assert.equal(result.conflicts[0].code, 'disk-deleted');

    result = syncPlan(base, [syncEntry('one.md', 'b')], []);
    assert.equal(result.conflicts[0].code, 'disk-deleted-and-local-changed');
});

test('file sync: disk mutation pauses for every unresolved issue in the folder', () => {
    const base = [syncEntry('one.md', 'a'), syncEntry('two.md', 'a')];
    const local = [syncEntry('one.md', 'b'), syncEntry('two.md', 'b')];
    const disk = [syncEntry('one.md', 'c'), syncEntry('two.md', 'a')];
    const result = syncPlan(base, local, disk);
    assert.equal(result.blocked, true);
    assert.equal(result.conflicts[0].path, 'one.md');
    assert.equal(result.actions.find(function (action) { return action.path === 'two.md'; }).type, 'write');
});

test('file sync: rename evidence is advisory only and ambiguity remains a conflict', () => {
    const base = [syncEntry('old.md', 'a')];
    let result = syncPlan(base, base, [syncEntry('new.md', 'a')]);
    assert.deepEqual(result.renames, [{ from: 'old.md', to: 'new.md', exact: syncFingerprint('a') }]);
    assert.equal(result.status, 'paused');

    result = syncPlan(base, base, [syncEntry('new.md', 'a'), syncEntry('copy.md', 'a')]);
    assert.equal(result.renames.length, 0);
    assert.ok(result.conflicts.some(function (item) { return item.code === 'rename-ambiguous'; }));
});

test('file sync: case and Unicode aliases conflict before any action can run', () => {
    const result = syncPlan([], [syncEntry('Café.md', 'a')], [syncEntry('Cafe\u0301.md', 'a')]);
    assert.equal(result.status, 'paused');
    assert.equal(result.conflicts[0].code, 'path-collision');
});

test('file sync: exact fingerprints, not timestamps, guard the final write preflight', () => {
    assert.ok(FileSync.preflight(syncFingerprint('a'), syncEntry('one.md', 'b', 'a')).ok);
    const changed = FileSync.preflight(syncFingerprint('a'), syncEntry('one.md', 'a', 'b'));
    assert.equal(changed.ok, false);
    assert.equal(changed.code, 'folder-changed-before-write');
    assert.equal(FileSync.preflight(null, null).ok, true);
    assert.equal(FileSync.preflight(null, syncEntry('one.md', 'a')).ok, false);
});

test('file sync: malformed snapshots are refused before planning', () => {
    assert.throws(function () { FileSync.plan({ baseline: [{ path: '../x', kind: 'text', exact: 'x', canonical: 'x' }] }); });
    assert.throws(function () { FileSync.plan({ baseline: [syncEntry('one.md', 'a'), syncEntry('one.md', 'a')] }); });
});
