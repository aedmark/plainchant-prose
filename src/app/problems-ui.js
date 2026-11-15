const inspProblemsPane = document.getElementById('inspProblemsPane');
const problemsList = document.getElementById('problemsList');
const problemsSummary = document.getElementById('problemsSummary');
const problemsCountBadge = document.getElementById('problemsCountBadge');
const linkChecker = Links.createChecker();
const hintChecker = Hints.createChecker();
const problemsFilterButtons = Array.from(document.querySelectorAll('.problems-filter-btn'));
let problemsTimer = null;
let problemsResult = { problems: [] };
let problemsFilter = settings.problemsFilter;

function knownProjectPaths() {
    const tree = Array.isArray(projectFiles.tree) ? projectFiles.tree.filter((item) => item.kind === 'file').map((item) => item.path) : [];
    return tree.concat(Object.keys(typeof projectAssets === 'object' ? projectAssets : {}));
}

function problemEntries() {
    ensureEntries();
    const entries = Object.assign({}, projectFiles.entries);
    if (activeFile in entries) entries[activeFile] = editor.value;
    return entries;
}

function runProblemsCheck() {
    clearTimeout(problemsTimer);
    problemsTimer = null;
    const entries = problemEntries();
    const links = linkChecker.check(entries, knownProjectPaths());
    const hints = hintChecker.check(entries);
    const order = Object.keys(entries);
    const problems = links.problems.map((problem) => Object.assign({ category: 'links' }, problem)).concat(hints.problems)
        .sort((a, b) => (order.indexOf(a.file) - order.indexOf(b.file)) || (a.start - b.start));
    problemsResult = { problems: problems };
    renderProblems();
}

function scheduleProblemsCheck() {
    clearTimeout(problemsTimer);
    problemsTimer = setTimeout(runProblemsCheck, 500);
}

function jumpToProblem(problem) {
    if (panesShown() === 'preview') setPanes('both');
    openFileInEditor(problem.file);
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(problem.start, problem.end);
    editor.scrollTop = Math.max(0, textTopIn(editor.value, problem.start) - editor.clientHeight / 3);
    shadeLayer.scrollTop = editor.scrollTop;
}

function renderProblems() {
    const filter = problemsFilter;
    const problems = problemsResult.problems.filter((problem) => filter === 'all' || problem.category === filter);
    const errors = problems.filter((problem) => problem.severity === 'error').length;
    const notes = problems.filter((problem) => problem.severity === 'info').length;
    const warnings = problems.length - errors - notes;
    problemsFilterButtons.forEach((button) => {
        const count = problemsResult.problems.filter((problem) => button.dataset.filter === 'all' || problem.category === button.dataset.filter).length;
        button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
        button.textContent = button.dataset.filter.charAt(0).toUpperCase() + button.dataset.filter.slice(1) + (count ? ' ' + count : '');
    });
    problemsCountBadge.hidden = problems.length === 0;
    problemsCountBadge.textContent = String(problems.length);
    problemsCountBadge.classList.toggle('has-error', errors > 0);
    if (inspProblemsPane.hidden) return;
    problemsSummary.textContent = problems.length
        ? errors + (errors === 1 ? ' error' : ' errors') + ', ' + warnings + (warnings === 1 ? ' warning' : ' warnings') + (notes ? ', ' + notes + (notes === 1 ? ' note' : ' notes') : '')
        : 'No problems found.';
    problemsList.textContent = '';
    problems.forEach((problem) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'list-row problem-row problem-' + problem.severity + ' problem-cat-' + problem.category;
        const level = document.createElement('span');
        level.className = 'list-level';
        level.textContent = problem.severity === 'error' ? 'error' : problem.severity === 'info' ? 'note' : 'warn';
        const message = document.createElement('span');
        message.className = 'list-msg';
        message.textContent = problem.message;
        const where = document.createElement('span');
        where.className = 'list-src';
        where.textContent = problem.file + (problem.line ? ':' + problem.line : '');
        row.append(level, message, where);
        row.title = 'Jump to ' + problem.file + (problem.line ? ' line ' + problem.line : '');
        row.addEventListener('click', () => jumpToProblem(problem));
        problemsList.appendChild(row);
    });
}

document.getElementById('problemsRecheckBtn').addEventListener('click', runProblemsCheck);
problemsFilterButtons.forEach((button) => button.addEventListener('click', () => {
    problemsFilter = button.dataset.filter;
    setSetting('problemsFilter', problemsFilter);
    renderProblems();
}));
