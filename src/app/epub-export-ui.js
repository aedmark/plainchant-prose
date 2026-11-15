// The inherited EPUB packer remains as a handoff foundation. Prose's manuscript-to-EPUB transformation is P3 work.

const epubExportSection = document.getElementById('epubExportSection');
const exportEpubBtn = document.getElementById('exportEpubBtn');

function refreshEpubExport() {
    const book = Project.isBookEntries(projectFiles.entries);
    epubExportSection.hidden = !book;
    document.getElementById('bundleExportSection').hidden = book;
    exportEpubBtn.textContent = hasTauri() ? 'Save .epub…' : 'Download .epub';
}

// The open EPUB project packed with its binary assets.
async function packOpenBook(when) {
    const binaries = {};
    for (const path of Object.keys(projectAssets || {})) if (!(path in projectFiles.entries)) binaries[path] = new Uint8Array(await projectAssets[path].arrayBuffer());
    return BookExport.pack(projectFiles.entries, binaries, when ? { when: when } : undefined);
}

async function exportEpub() {
    ensureEntries();
    syncBufferFromEditor();
    const assets = Object.keys(projectAssets || {});
    const read = Book.read(projectFiles.entries, { assets: assets });
    if (!read.model) { showNotice('content.opf cannot be read, so the book cannot be exported. Fix it in the code editor.', true); return; }
    const res = await packOpenBook();
    const name = BookExport.fileName(read.model.metadata.title);
    let where = name;
    if (hasTauri()) {
        const saved = await tauriInvoke('save_book_file', { name: name, data: await blobToBase64(new Blob([res.bytes])) });
        if (!saved) return;
        where = saved;
    } else {
        downloadFile(name, res.bytes, 'application/epub+zip');
    }
    const notes = [];
    if (res.left.length) notes.push('Left out, as content.opf does not list them: ' + res.left.slice(0, 5).join(', ') + (res.left.length > 5 ? ', and ' + (res.left.length - 5) + ' more' : '') + '.');
    if (res.missing.length) notes.push('Listed but missing: ' + res.missing.join(', ') + '.');
    showNotice('Exported ' + where + ' (' + res.order.length + ' files, ' + Math.max(1, Math.round(res.bytes.length / 1024)) + ' KB).' + (notes.length ? ' ' + notes.join(' ') : ''), res.missing.length > 0);
}

exportEpubBtn.addEventListener('click', () => {
    exportEpubBtn.disabled = true;
    exportEpub().catch((err) => showNotice('Could not export the book: ' + (err && err.message || err), true)).finally(() => { exportEpubBtn.disabled = false; });
});
