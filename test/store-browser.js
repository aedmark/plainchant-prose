/* Dependency-free Chromium IndexedDB suite for P1-04. CDP uses Chrome's inherited pipe file descriptors. */
const child = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const csp = config.app && config.app.security && config.app.security.csp;

function findChrome() {
    if (process.env.CHROME) return process.env.CHROME;
    for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
        const found = child.spawnSync('which', [name], { encoding: 'utf8' });
        if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
    }
    throw new Error('browser not run: no Chrome or Chromium found on PATH or in CHROME');
}

function startServer() {
    const html = '<!doctype html><meta charset="utf-8"><title>Store test</title>' +
        '<script src="/src/store-schema.js"></script><script src="/src/book-recovery.js"></script>' +
        '<script src="/src/store.js"></script><script src="/src/app/book-persistence.js"></script>' +
        '<script src="/test/store-browser-probe.js"></script>';
    const server = http.createServer(function (req, res) {
        const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        if (pathname === '/__store_test.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp,
                'Cache-Control': 'no-store' });
            res.end(html);
            return;
        }
        const file = path.resolve(root, pathname.replace(/^\/+/, ''));
        if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
        fs.readFile(file, function (error, bytes) {
            if (error) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Security-Policy': csp,
                'Cache-Control': 'no-store' });
            res.end(bytes);
        });
    });
    return new Promise(function (resolve, reject) {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', function () { resolve(server); });
    });
}

class CdpPipe {
    constructor(proc) {
        this.proc = proc;
        this.next = 1;
        this.pending = new Map();
        this.buffer = '';
        proc.stdio[4].setEncoding('utf8');
        proc.stdio[4].on('data', (chunk) => this.receive(chunk));
        proc.once('exit', (code) => {
            this.pending.forEach((entry) => entry.reject(new Error('Chromium exited ' + code)));
            this.pending.clear();
        });
    }
    receive(chunk) {
        this.buffer += chunk;
        let boundary;
        while ((boundary = this.buffer.indexOf('\0')) !== -1) {
            const raw = this.buffer.slice(0, boundary);
            this.buffer = this.buffer.slice(boundary + 1);
            if (!raw) continue;
            const message = JSON.parse(raw);
            if (!message.id || !this.pending.has(message.id)) continue;
            const entry = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) entry.reject(new Error(message.error.message));
            else entry.resolve(message.result || {});
        }
    }
    send(method, params, sessionId) {
        const id = this.next++;
        const message = { id: id, method: method, params: params || {} };
        if (sessionId) message.sessionId = sessionId;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve: resolve, reject: reject });
            this.proc.stdio[3].write(JSON.stringify(message) + '\0');
        });
    }
}

async function page(cdp, url) {
    const made = await cdp.send('Target.createTarget', { url: url });
    const attached = await cdp.send('Target.attachToTarget', { targetId: made.targetId, flatten: true });
    const session = attached.sessionId;
    await cdp.send('Runtime.enable', {}, session);
    const limit = Date.now() + 10000;
    while (Date.now() < limit) {
        const ready = await evaluate(cdp, session, 'Boolean(window.StoreBrowserTests)');
        if (ready) return { targetId: made.targetId, session: session };
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('store test page did not become ready');
}

async function evaluate(cdp, session, expression) {
    const result = await cdp.send('Runtime.evaluate', { expression: expression, awaitPromise: true,
        returnByValue: true, userGesture: true }, session);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception &&
        result.exceptionDetails.exception.description || result.exceptionDetails.text);
    return result.result && result.result.value;
}

function call(name, args) {
    return 'StoreBrowserTests.' + name + '(' + (args || []).map(JSON.stringify).join(',') + ')';
}

async function main() {
    if (typeof csp !== 'string' || !csp) throw new Error('src-tauri/tauri.conf.json has no page CSP');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-store-browser-'));
    const server = await startServer();
    const origin = 'http://127.0.0.1:' + server.address().port;
    const proc = child.spawn(findChrome(), ['--headless=new', '--no-sandbox', '--disable-gpu',
        '--disable-dev-shm-usage', '--user-data-dir=' + profile, '--remote-debugging-pipe', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', function (chunk) { stderr += chunk; });
    const cdp = new CdpPipe(proc);
    const timer = setTimeout(function () { proc.kill('SIGKILL'); }, 60000);
    try {
        const a = await page(cdp, origin + '/__store_test.html');
        const checks = await evaluate(cdp, a.session, call('freshAndRecovery', ['p104']));
        checks.forEach(function (name) { console.log('  ok   indexeddb: ' + name); });

        const b = await page(cdp, origin + '/__store_test.html');
        await evaluate(cdp, a.session, call('seedRace', ['p104-race']));
        const race = await Promise.all([
            evaluate(cdp, a.session, call('race', ['p104-race'])),
            evaluate(cdp, b.session, call('race', ['p104-race']))
        ]);
        race.sort();
        if (JSON.stringify(race) !== JSON.stringify(['book-revision-conflict', 'won'])) {
            throw new Error('two-tab race did not produce one winner and one revision conflict: ' + JSON.stringify(race));
        }
        console.log('  ok   indexeddb: two-tab revision race');

        const persistence = await evaluate(cdp, a.session, call('persistence', ['p105']));
        persistence.forEach(function (name) { console.log('  ok   persistence: ' + name); });

        await evaluate(cdp, a.session, call('seedCrash', ['p105-crash']));
        await cdp.send('Target.closeTarget', { targetId: a.targetId });
        const recoveredPage = await page(cdp, origin + '/__store_test.html');
        const recovered = await evaluate(cdp, recoveredPage.session, call('recoverCrash', ['p105-crash']));
        if (recovered.status !== 'recovered' || recovered.revision !== 1 ||
            recovered.one !== '# One\n\nRecovered one.\n' || recovered.two !== '# Two\n\nRecovered two.\n' ||
            recovered.bufferPresent) throw new Error('forced-close recovery failed: ' + JSON.stringify(recovered));
        console.log('  ok   persistence: forced target close and multi-file restart recovery');

        await evaluate(cdp, recoveredPage.session, call('holdV2', ['p104-blocked']));
        const blockedPromise = evaluate(cdp, b.session, call('openResult', ['p104-blocked']));
        const blocked = await blockedPromise;
        if (blocked.status !== 'blocked') throw new Error('blocked upgrade returned ' + JSON.stringify(blocked));
        await evaluate(cdp, recoveredPage.session, 'StoreBrowserTests.closeHeld()');
        console.log('  ok   indexeddb: blocked upgrade is explicit');

        const v3 = await evaluate(cdp, b.session, call('openResult', ['p104-versionchange']));
        if (v3.status !== 'ready') throw new Error('versionchange seed did not open');
        await evaluate(cdp, recoveredPage.session, call('holdStoreConnection', ['p104-versionchange']));
        await evaluate(cdp, b.session, call('upgradeRaw', ['p104-versionchange']));
        const state = await evaluate(cdp, recoveredPage.session, 'StoreBrowserTests.versionChangeState()');
        if (!state.notified || !state.closed) throw new Error('versionchange did not close the old connection');
        console.log('  ok   indexeddb: versionchange closes stale connection');

        const quotaServer = await startServer();
        const quotaOrigin = 'http://127.0.0.1:' + quotaServer.address().port;
        try {
            const quotaPage = await page(cdp, quotaOrigin + '/__store_test.html');
            await cdp.send('Storage.overrideQuotaForOrigin', { origin: quotaOrigin, quotaSize: 1024 },
                quotaPage.session);
            const quota = await evaluate(cdp, quotaPage.session, call('quota', ['p104-quota']));
            if (quota !== 'storage-quota') throw new Error('quota exhaustion returned ' + JSON.stringify(quota));
            console.log('  ok   indexeddb: Chromium quota exhaustion is classified');
        } finally {
            await new Promise((resolve) => quotaServer.close(resolve));
        }
        const total = checks.length + persistence.length + 5;
        console.log('\n' + total + '/' + total + ' passed');
    } finally {
        clearTimeout(timer);
        if (proc.exitCode === null) {
            const exited = new Promise((resolve) => proc.once('exit', resolve));
            try { await cdp.send('Browser.close'); } catch (problem) { proc.kill('SIGTERM'); }
            await exited;
        }
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
}

main().catch(function (error) {
    console.error('  FAIL indexeddb: ' + error.message);
    console.error('\n0/1 passed');
    process.exitCode = 1;
});
