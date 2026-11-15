/*
 * DAISY Ace remains an optional handoff oracle. P0-06 limits it to the retained export boundary; product-specific
 * accessibility assertions belong to the later Prose handoff work. Missing tooling reports "not run".
 */
const aceFs = require('fs');
const acePath = require('path');
const aceOs = require('os');
const aceChild = require('child_process');

function findAce() {
    if (process.env.PROSE_SKIP_ACE === '1') return { reason: 'PROSE_SKIP_ACE=1' };
    const cli = process.env.ACE_CLI || acePath.join(__dirname, '..', '.tools', 'ace', 'node_modules', '.bin', 'ace-cli');
    if (!aceFs.existsSync(cli)) return { reason: 'no ace-cli in .tools/ace/ or ACE_CLI' };
    let chrome = process.env.PUPPETEER_EXECUTABLE_PATH || null;
    if (chrome && !aceFs.existsSync(chrome)) return { reason: 'PUPPETEER_EXECUTABLE_PATH does not exist' };
    if (!chrome) {
        for (const name of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
            const found = aceChild.spawnSync('which', [name], { encoding: 'utf8' });
            if (found.status === 0 && found.stdout.trim()) {
                chrome = found.stdout.trim();
                break;
            }
        }
    }
    const puppeteerCache = acePath.join(aceOs.homedir(), '.cache', 'puppeteer');
    if (!chrome && !aceFs.existsSync(puppeteerCache)) return { reason: 'no Chrome or Chromium found for Ace' };
    return { cli: cli, chrome: chrome };
}

function runAce(ace, bytes) {
    const dir = aceFs.mkdtempSync(acePath.join(aceOs.tmpdir(), 'prose-ace-'));
    try {
        const epub = acePath.join(dir, 'book.epub');
        const output = acePath.join(dir, 'out');
        aceFs.writeFileSync(epub, bytes);
        const env = Object.assign({}, process.env, ace.chrome ? { PUPPETEER_EXECUTABLE_PATH: ace.chrome } : {});
        aceChild.execFileSync(ace.cli, ['-s', '-o', output, epub], { stdio: 'ignore', env: env, timeout: 180000 });
        return JSON.parse(aceFs.readFileSync(acePath.join(output, 'report.json'), 'utf8'));
    } finally {
        aceFs.rmSync(dir, { recursive: true, force: true });
    }
}

const aceOracle = findAce();

if (!aceOracle.cli) {
    console.log('  skip ace: not run (' + aceOracle.reason + ')');
} else {
    test('ace: the retained EPUB export produces a readable accessibility report', async () => {
        const packed = await BookExport.pack(EpubFixture.create().files, {});
        const report = runAce(aceOracle, packed.bytes);
        assert.ok(report && report['earl:assertedBy'], 'Ace report has an assertedBy record');
        assert.ok(Array.isArray(report.assertions), 'Ace report has document assertions');
    });
}
