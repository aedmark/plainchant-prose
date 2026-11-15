/*
 * Maintained Chromium smoke for P0-06. It uses only Node platform APIs, an installed Chrome or Chromium, a temporary
 * profile, and the exact CSP from the Tauri configuration. The test-only probe is served as a same-origin script so
 * it runs under the production policy without changing app.html.
 */
const child = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const csp = config.app && config.app.security && config.app.security.csp;
const mime = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.woff2': 'font/woff2'
};

function findChrome() {
    const named = process.env.CHROME;
    if (named) return fs.existsSync(named) ? { bin: named } : { reason: 'CHROME does not exist: ' + named };
    for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
        const found = child.spawnSync('which', [name], { encoding: 'utf8' });
        if (found.status === 0 && found.stdout.trim()) return { bin: found.stdout.trim() };
    }
    return { reason: 'no Chrome or Chromium found on PATH or in CHROME' };
}

function runChrome(bin, args) {
    return new Promise((resolve, reject) => {
        const proc = child.spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error('Chrome exceeded the 45 second browser-test limit'));
        }, 45000);
        proc.stdout.on('data', (chunk) => { stdout += chunk; });
        proc.stderr.on('data', (chunk) => { stderr += chunk; });
        proc.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        proc.once('close', (status) => {
            clearTimeout(timer);
            resolve({ status: status, stdout: stdout, stderr: stderr });
        });
    });
}

const probe = [
    "'use strict';",
    'window.__proseBrowserProblems = [];',
    'window.addEventListener("error", function (e) { window.__proseBrowserProblems.push("error: " + (e.message || e.type)); });',
    'window.addEventListener("unhandledrejection", function (e) { window.__proseBrowserProblems.push("rejection: " + String(e.reason)); });',
    'window.addEventListener("securitypolicyviolation", function (e) { window.__proseBrowserProblems.push("csp: " + e.violatedDirective); });',
    'window.addEventListener("DOMContentLoaded", function () {',
    '  setTimeout(async function () {',
    '    try {',
    '      if (typeof whenReady === "function") await Promise.race([whenReady(), new Promise(function (resolve) { setTimeout(resolve, 2000); })]);',
    '      if (typeof loadStarterProject === "function") loadStarterProject();',
    '      await new Promise(function (resolve) { setTimeout(resolve, 500); });',
    '      var frame = document.getElementById("stageFrame");',
    '      var frameDoc = frame && frame.contentDocument;',
    '      var state = {',
    '        title: document.title,',
    '        frameLoaded: Boolean(frameDoc && frameDoc.body),',
    '        bridgeLoaded: Boolean(frameDoc && frameDoc.getElementById("pc-stage-badge")),',
    '        problems: window.__proseBrowserProblems',
    '      };',
    '      document.documentElement.setAttribute("data-prose-browser-result", encodeURIComponent(JSON.stringify(state)));',
    '    } catch (e) {',
    '      document.documentElement.setAttribute("data-prose-browser-result", encodeURIComponent(JSON.stringify({ problems: ["probe: " + e.message] })));',
    '    }',
    '  }, 0);',
    '});'
].join('\n');

function serveFile(req, res) {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__prose_browser_probe.js') {
        res.writeHead(200, { 'Content-Type': mime['.js'], 'Content-Security-Policy': csp });
        res.end(probe);
        return;
    }
    const rel = pathname.replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
    }
    fs.readFile(file, (error, bytes) => {
        if (error) {
            res.writeHead(404);
            res.end();
            return;
        }
        let body = bytes;
        if (rel === 'app.html') {
            body = Buffer.from(bytes.toString('utf8').replace('<head>', '<head>\n<script src="/__prose_browser_probe.js"></script>'));
        }
        res.writeHead(200, {
            'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
            'Content-Security-Policy': csp,
            'Cache-Control': 'no-store'
        });
        res.end(body);
    });
}

async function main() {
    if (typeof csp !== 'string' || !csp) throw new Error('src-tauri/tauri.conf.json has no page CSP');
    const chrome = findChrome();
    if (!chrome.bin) throw new Error('browser not run: ' + chrome.reason);

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-browser-'));
    const server = http.createServer(serveFile);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const url = 'http://127.0.0.1:' + server.address().port + '/app.html';
    try {
        const result = await runChrome(chrome.bin, [
            '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
            '--user-data-dir=' + profile, '--virtual-time-budget=30000', '--dump-dom', url
        ]);
        if (result.status !== 0) throw new Error('Chrome exited ' + result.status + ': ' + result.stderr.trim());
        const match = result.stdout.match(/data-prose-browser-result="([^"]+)"/);
        if (!match) throw new Error('the browser probe did not finish; Chrome: ' +
            (result.stderr.trim().split('\n').slice(-3).join(' | ') || 'no diagnostic') +
            '; DOM tail: ' + result.stdout.slice(-500).replace(/\s+/g, ' '));
        const state = JSON.parse(decodeURIComponent(match[1].replace(/&amp;/g, '&')));
        const problems = Array.isArray(state.problems) ? state.problems : ['probe returned no problem list'];
        if (state.title !== 'Plainchant Prose: long-form writer') problems.push('unexpected title: ' + state.title);
        if (!state.frameLoaded) problems.push('Stage frame did not load');
        if (!state.bridgeLoaded) problems.push('Stage interaction bridge did not load');
        if (problems.length) throw new Error(problems.join('; '));
        const version = child.spawnSync(chrome.bin, ['--version'], { encoding: 'utf8' }).stdout.trim();
        console.log('  ok   browser: starter Stage and bridge load under the exact CSP (' + version + ')');
        console.log('\n1/1 passed');
    } finally {
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error('  FAIL browser: ' + error.message);
    console.error('\n0/1 passed');
    process.exitCode = 1;
});
