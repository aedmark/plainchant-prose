test('book archive: explicit browser transfer preserves manuscript bytes and research bytes', async () => {
    const entries = [
        { path: 'chapter/one.md', kind: 'text', text: '\ufeff# One\r\n\r\nText.\r\n' },
        { path: 'research/map.bin', kind: 'binary', bytes: Uint8Array.from([0, 1, 2, 255]) },
        { path: 'book.txt', kind: 'text', text: 'Title: Book\nAuthor: Writer\nLanguage: en\n\nchapter/one.md\n' }
    ];
    const bytes = await BookArchive.build(entries, new Date(2020, 0, 2, 3, 4, 6));
    const listed = Zip.list(bytes);
    assert.equal(listed[0].path, 'book.txt');
    const read = await BookArchive.read(bytes);
    assert.equal(read[0].text, entries[2].text);
    assert.equal(read[1].text, entries[0].text);
    assert.deepEqual(Array.from(read[2].bytes), [0, 1, 2, 255]);
});

test('book archive: transfer admits only book.txt, chapters, and research paths', async () => {
    const index = { path: 'book.txt', kind: 'text', text: 'Title: B\n' };
    const invalid = ['../one.md', '/one.md', 'C:/one.md', 'notes.txt', 'a\\one.md', 'research/../one.md'];
    for (const path of invalid) {
        let code = null;
        try { await BookArchive.build([index, { path: path, kind: 'text', text: 'x' }]); }
        catch (error) { code = error.code; }
        assert.equal(code, 'book-package-path-invalid', path);
    }
});

test('book archive: missing index and case or Unicode collisions refuse the whole package', async () => {
    let code = null;
    try { await BookArchive.build([{ path: 'one.md', kind: 'text', text: '# One' }]); }
    catch (error) { code = error.code; }
    assert.equal(code, 'book-package-index-invalid');

    code = null;
    try { await BookArchive.build([
        { path: 'book.txt', kind: 'text', text: 'x' },
        { path: 'Café.md', kind: 'text', text: 'a' },
        { path: 'Cafe\u0301.md', kind: 'text', text: 'b' }
    ]); } catch (error) { code = error.code; }
    assert.equal(code, 'book-package-path-collision');
});

test('book archive: count and byte limits are enforced before export', async () => {
    const index = { path: 'book.txt', kind: 'text', text: 'x' };
    let code = null;
    try { await BookArchive.build([index, { path: 'huge.md', kind: 'text',
        text: 'x'.repeat(BookArchive.LIMITS.file + 1) }]); } catch (error) { code = error.code; }
    assert.equal(code, 'book-package-file-too-large');
});
