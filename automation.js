(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'bbuddy_auto';
  const PL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  const AS = { manual: 'Manual', candidate: 'Candidate', progress: 'In progress', done: 'Automated', skip: 'Not suitable' };
  const RS = { todo: 'Not tested', pass: 'Pass', concern: 'Concern', fail: 'Fail' };
  const STAGES = [
    ['goal', 'Set the goal and the limits', 'Decide what AI helps with (ideas, drafts) and what stays human (final judgement, release decisions).'],
    ['data', 'Prepare safe inputs', 'Remove personal data, passwords, tokens and confidential details before pasting anything.'],
    ['prompt', 'Write a clear prompt', 'Give the requirement, the format you want, and what to do when something is unclear.'],
    ['review', 'Review every output', 'Check each generated case against the real requirement. AI can invent features.'],
    ['run', 'Run it and verify', 'Execute the tests yourself. A generated test isn’t proven until it has run.'],
    ['log', 'Record and improve', 'Keep prompts that worked, note what the AI got wrong, and track the time saved.']
  ];
  const REVIEW = [
    ['r1', 'Every step matches a real feature in the requirement'],
    ['r2', 'Expected results are specific, not vague'],
    ['r3', 'Negative, boundary and empty-input cases are included'],
    ['r4', 'There are no duplicate or near-identical cases'],
    ['r5', 'Test data is realistic and contains no real personal data'],
    ['r6', 'Selectors, URLs and API names were checked in the real app'],
    ['r7', 'A person has run the tests at least once']
  ];
  const AIQ = [
    ['Accuracy', 'Answers match trusted sources on questions you can verify'],
    ['Hallucination', 'It admits when it doesn’t know instead of inventing facts or sources'],
    ['Consistency', 'Similar questions give consistent answers across repeated runs'],
    ['Prompt injection', 'It ignores instructions hidden in user input or documents'],
    ['Safety', 'It refuses harmful requests and handles sensitive topics with care'],
    ['Bias', 'Results don’t change unfairly with names, gender, age or background'],
    ['Privacy', 'It doesn’t reveal other users’ data or its hidden instructions'],
    ['Robustness', 'It copes with typos, very long input, other languages and empty input']
  ];
  const TASKS = {
    cases: ['Generate test cases', 'Write test cases for the requirement below. Include positive, negative, boundary and empty-input cases.'],
    edge: ['Find edge cases', 'List edge cases and unusual inputs that could break the feature below, and explain why each matters.'],
    gaps: ['Review my test cases', 'Review the test cases below against the requirement. Point out missing scenarios, unclear steps and duplicates.'],
    bug: ['Draft a bug report', 'Turn the notes below into a bug report with a title, steps to reproduce, expected result, actual result and suggested severity.'],
    auto: ['Write an automation script', 'Write an automated test for the test case below. Use stable selectors and clear assertions, and mark anything you had to guess.']
  };

  /* ---------- Helpers ---------- */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c); });
    return e;
  }
  function opts(sel, pairs, val) {
    sel.replaceChildren(...pairs.map(([v, t]) => h('option', { value: v }, t)));
    if (val && pairs.some((p) => p[0] === val)) sel.value = val;
  }
  function toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2000);
  }
  function copy(text) {
    const done = () => toast('Copied to clipboard');
    function fallback() {
      const t = h('textarea', { style: 'position:fixed;opacity:0' });
      t.value = text; document.body.append(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      t.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const slug = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cases = () => (window.BTesting ? window.BTesting.getCases() : []);

  /* ---------- Saved state ---------- */
  let st = { status: {}, stages: {}, review: {}, ai: {} };
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') st = Object.assign(st, d);
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  /* ---------- Markup ---------- */
  navList.insertAdjacentHTML('beforeend', '<button class="nav" id="au-btn">Automation</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="auto-view" style="display:none">
    <header class="top"><div><h1>Automation and AI</h1><p class="sub">Decide what to automate, generate starter scripts and use AI safely in testing.</p></div></header>
    <div class="tabs">
      <button type="button" class="tab" data-at="cand">Automation tracker</button>
      <button type="button" class="tab" data-at="script">Scripts and CI</button>
      <button type="button" class="tab" data-at="ai">AI process</button>
    </div>

    <div id="au-cand" class="stack">
      <div class="stats" id="au-stats"></div>
      <div class="tool">
        <h2>Payback calculator</h2>
        <p class="desc">A rough estimate of how long automating a regression suite takes to pay for itself.</p>
        <div class="eq">
          <div class="field"><label for="au-min">Minutes to run the suite by hand</label><input class="input" id="au-min" type="number" min="0" placeholder="90"></div>
          <div class="field"><label for="au-runs">Runs per month</label><input class="input" id="au-runs" type="number" min="0" placeholder="8"></div>
        </div>
        <div class="field"><label for="au-hrs">Hours to build the automation</label><input class="input" id="au-hrs" type="number" min="0" placeholder="40"></div>
        <p class="stat-line" id="au-roi" aria-live="polite"></p>
      </div>
      <div class="stack" id="au-list"></div>
    </div>

    <div id="au-script" class="stack" hidden>
      <div class="tool">
        <h2>Starter script generator</h2>
        <p class="desc">Turns a test case into a script skeleton. Your steps become comments with TODO lines, because plain-text steps can’t tell the tool which buttons or fields to use.</p>
        <div class="eq">
          <div class="field"><label for="au-fw">Framework</label><select class="input" id="au-fw"><option value="playwright">Playwright (JavaScript)</option><option value="cypress">Cypress (JavaScript)</option><option value="selenium">Selenium (Python)</option></select></div>
          <div class="field"><label for="au-case">Test case</label><select class="input" id="au-case"></select></div>
        </div>
        <div class="field"><label for="au-url">Page address</label><input class="input" id="au-url" inputmode="url" placeholder="http://localhost:3000/login.html"></div>
        <pre class="out" id="au-out"></pre>
        <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="au-copy">Copy script</button></div>
      </div>
      <div class="tool">
        <h2>CI workflow (GitHub Actions)</h2>
        <p class="desc">Runs your tests on every push and pull request. Save it as <strong>.github/workflows/tests.yml</strong> and adjust the start command and port to match your project.</p>
        <pre class="out" id="au-ci"></pre>
        <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="au-cicopy">Copy workflow</button></div>
      </div>
    </div>

    <div id="au-ai" class="stack" hidden>
      <div class="tool">
        <h2>AI-assisted testing workflow</h2>
        <p class="desc">Six steps for using AI in testing without trusting it blindly.</p>
        <div id="au-stages"></div>
        <p class="stat-line" id="au-prog" aria-live="polite"></p>
        <div class="tool-actions"><button type="button" class="btn btn-ghost sm" id="au-newround">Start a new round</button></div>
      </div>
      <div class="tool">
        <h2>Prompt builder</h2>
        <p class="desc">Builds a careful prompt to paste into any AI assistant. Nothing is sent from this page.</p>
        <div class="eq">
          <div class="field"><label for="au-task">What do you need?</label><select class="input" id="au-task"></select></div>
          <div class="field"><label for="au-ctx">Context (optional)</label><input class="input" id="au-ctx" placeholder="Web app, React, Chrome and Safari"></div>
        </div>
        <div class="field"><label for="au-in">Requirement, test cases or notes</label><textarea class="input" id="au-in" rows="5"></textarea></div>
        <label class="opt"><input type="checkbox" id="au-tbl"> Ask for the result as a table</label>
        <p class="error" id="au-warn" aria-live="polite"></p>
        <pre class="out" id="au-prompt"></pre>
        <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="au-pcopy">Copy prompt</button></div>
      </div>
      <div class="tool">
        <h2>Review checklist for AI-generated tests</h2>
        <p class="desc">Tick each item before you accept generated cases or scripts.</p>
        <div id="au-review"></div>
      </div>
      <div class="tool">
        <h2>Testing an AI feature</h2>
        <p class="desc">If your product uses AI, record how it does in each risk area.</p>
        <div id="au-feat" class="stack"></div>
        <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="au-fcopy">Copy results</button></div>
      </div>
    </div>
  </section>`);

  /* ---------- Automation tracker ---------- */
  function score(c) {
    let s = { critical: 3, high: 2, medium: 1, low: 0 }[c.priority] || 0;
    s += { Functional: 2, Negative: 2, Boundary: 2, Security: 1, Performance: 1, Compatibility: 1 }[c.type] || 0;
    return s >= 4 ? 'Good candidate' : s >= 2 ? 'Maybe' : 'Keep manual';
  }
  const status = (c) => st.status[c.id] || 'manual';

  function renderCand() {
    const list = cases(), t = list.length;
    const n = (s) => list.filter((c) => status(c) === s).length;
    const good = list.filter((c) => status(c) === 'manual' && score(c) === 'Good candidate').length;
    const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, v), h('div', { class: 'stat-label' }, l));
    $('au-stats').replaceChildren(stat(t, 'Test cases'), stat(t ? Math.round(n('done') * 100 / t) + '%' : '0%', 'Automated'), stat(n('progress'), 'In progress'), stat(good, 'Good candidates left'));

    const root = $('au-list');
    if (!window.BTesting) { root.replaceChildren(h('p', { class: 'sub' }, 'Test cases aren’t available yet. Add the one-line edit to testing.js to see them here.')); return; }
    if (!t) { root.replaceChildren(h('p', { class: 'sub' }, 'No test cases yet. Add some in the Testing section.')); return; }
    root.replaceChildren(...list.map((c) => {
      const sel = h('select', { class: 'status', 'aria-label': 'Automation status for ' + c.id });
      opts(sel, Object.entries(AS), status(c));
      sel.addEventListener('change', () => { st.status[c.id] = sel.value; save(); renderCand(); });
      return h('article', { class: 'tcase' },
        h('div', { class: 'tcase-head' }, h('h3', {}, c.id + ' ' + c.title),
          h('div', { class: 'tool-actions' }, h('span', { class: 'badge sev-' + c.priority }, PL[c.priority] || c.priority), h('span', { class: 'chip' }, c.type))),
        h('div', { class: 'tcase-foot' }, sel, h('span', { class: 'chip' }, 'Suggestion: ' + score(c))));
    }));
  }
  function roi() {
    const m = +$('au-min').value, r = +$('au-runs').value, b = +$('au-hrs').value, o = $('au-roi');
    if (!(m > 0 && r > 0 && b > 0)) { o.textContent = 'Enter all three numbers to see the payback time.'; return; }
    const saved = m * r / 60, months = b / saved;
    o.textContent = 'Saves about ' + saved.toFixed(1) + ' hours a month and pays for itself ' + (months < 1 ? 'in under a month' : 'in about ' + months.toFixed(1) + ' months') + '. Add time for maintenance to be realistic.';
  }
  ['au-min', 'au-runs', 'au-hrs'].forEach((id) => $(id).addEventListener('input', roi));
  roi();

  /* ---------- Scripts and CI ---------- */
  function script(fw, c, url) {
    const steps = c.steps.split('\n').map(clean).filter(Boolean);
    const name = JSON.stringify(c.id + ' ' + c.title), u = JSON.stringify(url || 'http://localhost:3000');
    const exp = clean(c.expected);
    let L;
    if (fw === 'playwright') {
      L = ["import { test, expect } from '@playwright/test';", '', 'test(' + name + ', async ({ page }) => {', '  await page.goto(' + u + ');'];
      steps.forEach((s, i) => L.push('  // Step ' + (i + 1) + ': ' + s, "  // TODO: await page.getByLabel('...').fill('...') or page.getByRole('button', { name: '...' }).click()"));
      L.push('  // Expected: ' + exp, "  // TODO: await expect(page.getByText('...')).toBeVisible();", '});');
    } else if (fw === 'cypress') {
      L = ['describe(' + JSON.stringify(c.scenario) + ', () => {', '  it(' + name + ', () => {', '    cy.visit(' + u + ');'];
      steps.forEach((s, i) => L.push('    // Step ' + (i + 1) + ': ' + s, "    // TODO: cy.get('[data-test=\"...\"]').type('...') or .click()"));
      L.push('    // Expected: ' + exp, "    // TODO: cy.contains('...').should('be.visible');", '  });', '});');
    } else {
      L = ['from selenium import webdriver', 'from selenium.webdriver.common.by import By', '', '', 'def test_' + slug(c.id) + '():', '    driver = webdriver.Chrome()', '    try:', '        driver.get(' + u + ')'];
      steps.forEach((s, i) => L.push('        # Step ' + (i + 1) + ': ' + s, '        # TODO: driver.find_element(By.ID, "...").send_keys("...") or .click()'));
      L.push('        # Expected: ' + exp, '        # TODO: assert "..." in driver.page_source', '    finally:', '        driver.quit()');
    }
    return L.join('\n');
  }
  function ci(fw) {
    const head = ['name: Automated tests', 'on: [push, pull_request]', 'jobs:', '  test:', '    runs-on: ubuntu-latest', '    steps:', '      - uses: actions/checkout@v4'];
    const tail = fw === 'playwright'
      ? ['      - uses: actions/setup-node@v4', '        with:', '          node-version: 20', '      - run: npm ci', '      - run: npx playwright install --with-deps', '      - run: npx playwright test', '      - uses: actions/upload-artifact@v4', '        if: always()', '        with:', '          name: playwright-report', '          path: playwright-report/']
      : fw === 'cypress'
        ? ['      - uses: cypress-io/github-action@v6', '        with:', '          start: npm start', "          wait-on: 'http://localhost:3000'"]
        : ['      - uses: actions/setup-python@v5', '        with:', "          python-version: '3.12'", '      - run: pip install selenium pytest', '      - run: pytest'];
    return head.concat(tail).join('\n');
  }
  function fillCases() {
    const sel = $('au-case');
    opts(sel, cases().map((c) => [c.id, c.id + ' ' + c.title]), sel.value);
    drawScript();
  }
  function drawScript() {
    const c = cases().find((x) => x.id === $('au-case').value);
    $('au-out').textContent = c ? script($('au-fw').value, c, $('au-url').value.trim()) : 'Add a test case in Testing first.';
    $('au-ci').textContent = ci($('au-fw').value);
  }
  ['au-fw', 'au-case'].forEach((id) => $(id).addEventListener('change', drawScript));
  $('au-url').addEventListener('input', drawScript);
  $('au-copy').addEventListener('click', () => copy($('au-out').textContent));
  $('au-cicopy').addEventListener('click', () => copy($('au-ci').textContent));

  /* ---------- AI process ---------- */
  function checklist(root, items, store, onChange) {
    root.replaceChildren(...items.map(([id, title, desc]) => {
      const box = h('input', { type: 'checkbox' });
      box.checked = !!store[id];
      box.addEventListener('change', () => { store[id] = box.checked; save(); if (onChange) onChange(); });
      return h('label', { class: 'stage' }, box, h('div', {}, h('strong', {}, title), desc ? h('span', {}, desc) : null));
    }));
  }
  function progress() {
    const n = STAGES.filter((s) => st.stages[s[0]]).length;
    $('au-prog').textContent = n + ' of ' + STAGES.length + ' steps done in this round.';
  }
  $('au-newround').addEventListener('click', () => { st.stages = {}; save(); checklist($('au-stages'), STAGES, st.stages, progress); progress(); });

  opts($('au-task'), Object.entries(TASKS).map(([k, v]) => [k, v[0]]));
  function drawPrompt() {
    const t = TASKS[$('au-task').value], ctx = $('au-ctx').value.trim(), inp = $('au-in').value.trim();
    $('au-warn').textContent = /[\w.+-]+@[\w-]+\.[\w.-]+|\b[A-Za-z0-9_-]{32,}\b|Bearer\s+\S+/.test(inp + ' ' + ctx)
      ? 'This looks like it contains an email address or a token. Remove it before you send it to an AI tool.' : '';
    const L = ['Act as a careful QA engineer.', '', 'Task: ' + t[1]];
    if (ctx) L.push('Context: ' + ctx);
    L.push('', 'Rules:', '- Use only the information I give you. Don’t invent features, fields or behaviour.', '- List your assumptions and ask about anything unclear.', '- Keep every item short and specific.',
      $('au-tbl').checked ? '- Present the result as a table.' : '- Present the result as a numbered list.',
      '', 'Input:', '"""', inp || '(paste the requirement, test cases or notes here)', '"""');
    $('au-prompt').textContent = L.join('\n');
  }
  ['au-task', 'au-ctx', 'au-in', 'au-tbl'].forEach((id) => { $(id).addEventListener('input', drawPrompt); $(id).addEventListener('change', drawPrompt); });
  $('au-pcopy').addEventListener('click', () => copy($('au-prompt').textContent));

  function drawFeat() {
    $('au-feat').replaceChildren(...AIQ.map(([name, desc]) => {
      const sel = h('select', { class: 'input', id: 'au-ai-' + slug(name) });
      opts(sel, Object.entries(RS), st.ai[name] || 'todo');
      sel.addEventListener('change', () => { st.ai[name] = sel.value; save(); });
      return h('div', { class: 'field' }, h('label', { for: sel.id }, name), h('p', { class: 'stat-line' }, desc), sel);
    }));
  }
  $('au-fcopy').addEventListener('click', () => copy('## AI feature test results\n' + AIQ.map(([n]) => '- ' + n + ': ' + RS[st.ai[n] || 'todo']).join('\n')));

  /* ---------- Tabs and navigation ---------- */
  const P = { cand: $('au-cand'), script: $('au-script'), ai: $('au-ai') };
  function setTab(t) {
    Object.keys(P).forEach((k) => { P[k].hidden = k !== t; });
    document.querySelectorAll('[data-at]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.at === t)));
    if (t === 'cand') renderCand();
    if (t === 'script') fillCases();
  }
  document.querySelectorAll('[data-at]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.at)));

  const view = $('auto-view'), btn = $('au-btn');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  function show(on) {
    if (on) {
      reportEls.forEach((el) => { el.style.display = 'none'; });
      ['tools-view', 'test-view'].forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
      ['tools-btn', 'test-btn'].forEach((id) => { const b = $(id); if (b) b.setAttribute('aria-current', 'false'); });
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
      const active = document.querySelector('[data-at][aria-current="true"]');
      setTab(active ? active.dataset.at : 'cand');
    }
    view.style.display = on ? '' : 'none';
    btn.setAttribute('aria-current', String(on));
  }
  btn.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => show(false)));
  ['tools-btn', 'test-btn'].forEach((id) => { const b = $(id); if (b) b.addEventListener('click', () => show(false)); });

  checklist($('au-stages'), STAGES, st.stages, progress);
  checklist($('au-review'), REVIEW, st.review);
  progress(); drawPrompt(); drawFeat();
  setTab('cand');
})();