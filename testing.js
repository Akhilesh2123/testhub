(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'bbuddy_testing';
  const PL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  const ST = { todo: 'Not run', pass: 'Pass', fail: 'Fail', blocked: 'Blocked' };
  const TYPES = ['Functional', 'Negative', 'Boundary', 'UI', 'Security', 'Accessibility', 'Compatibility', 'Performance'];
  const PTYPES = ['Functional', 'Regression', 'Smoke', 'UI', 'Security', 'Accessibility', 'Compatibility', 'Performance'];
  const STARTERS = [
    ['works with valid input', 'Functional', 'Complete the flow with valid details', 'The flow completes successfully'],
    ['rejects invalid input', 'Negative', 'Enter invalid details and submit', 'A clear error appears and nothing is saved'],
    ['required fields left empty', 'Negative', 'Leave the required fields empty and submit', 'Each missing field shows an error'],
    ['works with keyboard only', 'Accessibility', 'Complete the flow using only Tab, Enter and Space', 'Every control can be reached and the focus is visible']
  ];

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
  const opts = (sel, pairs, val) => {
    sel.replaceChildren(...pairs.map(([v, t]) => h('option', { value: v }, t)));
    if (val) sel.value = val;
  };
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
  function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const nextId = (list, p, pad) => p + String(Math.max(0, ...list.map((x) => parseInt(x.id.split('-')[1], 10) || 0)) + 1).padStart(pad, '0');

  /* ---------- Data ---------- */
  function seed() {
    const k = (n, scenario, title, type, priority, steps, expected) => ({ id: 'TC-' + String(n).padStart(3, '0'), scenario, title, type, priority, pre: '', steps, expected, data: '', status: 'todo', run: null, bug: null });
    return {
      plan: {
        name: 'Bug Reporting Buddy v1.0', owner: '', start: '', end: '',
        objective: 'Confirm that sign-in, sign-up, password reset and the dashboard work as intended before release.',
        inScope: 'Login, sign-up, forgot password, Google sign-in, dashboard reports, tools',
        outScope: 'Real email delivery and third-party services',
        types: ['Functional', 'Regression', 'Smoke', 'UI', 'Accessibility'],
        env: 'Latest Chrome, Firefox and Safari. Windows, macOS, Android and iOS.',
        entry: 'The build is deployed and the smoke tests pass.',
        exit: 'No open Critical or High bugs, 95% of planned cases run, and a pass rate of 90% or higher.',
        risks: 'The demo sign-in has no real backend. Device coverage is limited.'
      },
      scenarios: [
        { id: 'TS-01', title: 'User can sign in', area: 'Login', priority: 'critical' },
        { id: 'TS-02', title: 'User can create an account', area: 'Sign-up', priority: 'high' },
        { id: 'TS-03', title: 'User can reset a forgotten password', area: 'Forgot password', priority: 'high' },
        { id: 'TS-04', title: 'User can manage bug reports', area: 'Dashboard', priority: 'medium' }
      ],
      cases: [
        k(1, 'TS-01', 'Sign in with valid details', 'Functional', 'critical', 'Open the sign-in page\nEnter a valid email and a password of 8 or more characters\nSelect Sign in', 'The dashboard opens with a welcome message'),
        k(2, 'TS-01', 'Sign in with an invalid email', 'Negative', 'high', 'Open the sign-in page\nEnter "abc" as the email\nSelect Sign in', 'An error asks for a valid email and no sign-in happens'),
        k(3, 'TS-01', 'Password shorter than 8 characters', 'Boundary', 'medium', 'Enter a valid email\nEnter a 7-character password\nSelect Sign in', 'The error says passwords need at least 8 characters'),
        k(4, 'TS-02', 'Sign-up with mismatched passwords', 'Negative', 'high', 'Open the sign-up page\nEnter two different passwords\nSelect Create account', 'An error says the passwords don’t match'),
        k(5, 'TS-02', 'Terms box is required', 'Functional', 'medium', 'Fill in every field\nLeave the terms box unticked\nSelect Create account', 'An error asks you to agree to the terms'),
        k(6, 'TS-03', 'Reset a password with a 6-digit code', 'Functional', 'high', 'Open Forgot password\nEnter your email and request a code\nEnter the code and a new password', 'The password updates and you reach the dashboard'),
        k(7, 'TS-04', 'Report a bug and see it in the list', 'Functional', 'high', 'Select Report a bug\nEnter a title and severity\nSubmit the report', 'The new report appears at the top of the list as Open'),
        k(8, 'TS-04', 'Dashboard works on a phone screen', 'UI', 'medium', 'Open the dashboard on a 375px wide screen\nUse the filters and open the report form', 'Nothing overlaps or scrolls sideways')
      ]
    };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.plan && Array.isArray(d.scenarios) && Array.isArray(d.cases)) { d.plan.types = d.plan.types || []; return d; }
    } catch (e) {}
    return seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  let db = load();
  let editing = null;
  const open = new Set();

  /* ---------- Markup ---------- */
  navList.insertAdjacentHTML('beforeend', '<button class="nav" id="test-btn">Testing</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="test-view" style="display:none">
    <header class="top"><div><h1>Testing</h1><p class="sub">Plan the work, write cases, record results and see where quality stands.</p></div></header>
    <div class="tabs">
      <button type="button" class="tab" data-tab="plan">Test plan</button>
      <button type="button" class="tab" data-tab="scen">Scenarios</button>
      <button type="button" class="tab" data-tab="cases">Test cases</button>
      <button type="button" class="tab" data-tab="sum">Summary</button>
    </div>

    <div id="t-plan" class="stack">
      <div class="tool" id="p-form"></div>
      <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="p-copy">Copy plan as Markdown</button><button type="button" class="btn btn-ghost sm" id="p-dl">Download plan (.md)</button></div>
    </div>

    <div id="t-scen" class="stack" hidden>
      <form class="tool" id="s-form" novalidate>
        <h2>Add a test scenario</h2>
        <p class="desc">A scenario is a situation worth testing, like “User can sign in”. Test cases then break it into exact steps.</p>
        <div class="scol">
          <div class="field"><label for="s-title">Scenario</label><input class="input" id="s-title" maxlength="120" placeholder="User can change their email"></div>
          <div class="field"><label for="s-area">Area</label><input class="input" id="s-area" maxlength="40" placeholder="Settings"></div>
          <div class="field"><label for="s-pri">Priority</label><select class="input" id="s-pri"></select></div>
          <button type="submit" class="btn btn-primary sm">Add</button>
        </div>
        <p class="error" id="s-err"></p>
      </form>
      <ul class="matches" id="s-list"></ul>
    </div>

    <div id="t-cases" class="stack" hidden>
      <form class="tool" id="c-form" novalidate>
        <h2 id="c-head">Add a test case</h2>
        <div class="eq">
          <div class="field"><label for="c-title">Title</label><input class="input" id="c-title" maxlength="140" placeholder="Sign in with a wrong password"></div>
          <div class="field"><label for="c-scen">Scenario</label><select class="input" id="c-scen"></select></div>
        </div>
        <div class="eq">
          <div class="field"><label for="c-type">Type</label><select class="input" id="c-type"></select></div>
          <div class="field"><label for="c-pri">Priority</label><select class="input" id="c-pri"></select></div>
        </div>
        <div class="field"><label for="c-pre">Before you start (optional)</label><input class="input" id="c-pre" maxlength="200" placeholder="An account already exists"></div>
        <div class="field"><label for="c-steps">Steps (one per line)</label><textarea class="input" id="c-steps" rows="4" placeholder="Open the sign-in page&#10;Enter a wrong password&#10;Select Sign in"></textarea></div>
        <div class="eq">
          <div class="field"><label for="c-exp">Expected result</label><textarea class="input" id="c-exp" rows="3"></textarea></div>
          <div class="field"><label for="c-data">Test data (optional)</label><textarea class="input" id="c-data" rows="3" placeholder="Email: test@example.com"></textarea></div>
        </div>
        <p class="error" id="c-err"></p>
        <div class="tool-actions"><button type="submit" class="btn btn-primary sm" id="c-submit">Add test case</button><button type="button" class="btn btn-ghost sm" id="c-cancel" hidden>Cancel edit</button></div>
      </form>
      <div class="tfilters">
        <input class="input" type="search" id="c-q" placeholder="Search cases" aria-label="Search test cases">
        <select class="input" id="c-filter" aria-label="Filter by result"></select>
      </div>
      <div class="stack" id="c-list"></div>
    </div>

    <div id="t-sum" class="stack" hidden></div>
  </section>`);

  const view = $('test-view');
  const panels = { plan: $('t-plan'), scen: $('t-scen'), cases: $('t-cases'), sum: $('t-sum') };
  opts($('s-pri'), Object.entries(PL), 'medium');
  opts($('c-pri'), Object.entries(PL), 'medium');
  opts($('c-type'), TYPES.map((t) => [t, t]));
  opts($('c-filter'), [['all', 'All results']].concat(Object.entries(ST)));

  /* ---------- Test plan ---------- */
  function buildPlan() {
    const p = db.plan;
    const bind = (el, key) => { el.value = p[key] || ''; el.addEventListener('input', () => { p[key] = el.value; save(); }); return el; };
    const field = (key, label, kind) => h('div', { class: 'field' },
      h('label', { for: 'p-' + key }, label),
      bind(kind === 'ta' ? h('textarea', { class: 'input', id: 'p-' + key, rows: 3 }) : h('input', { class: 'input', id: 'p-' + key, type: kind }), key));
    const types = h('fieldset', {}, h('legend', {}, 'Test types'),
      h('div', { class: 'tool-actions', style: 'gap:8px 18px' }, PTYPES.map((t) => {
        const box = h('input', { type: 'checkbox' });
        box.checked = p.types.includes(t);
        box.addEventListener('change', () => { p.types = PTYPES.filter((x) => (x === t ? box.checked : p.types.includes(x))); save(); });
        return h('label', { class: 'opt' }, box, t);
      })));
    $('p-form').append(
      h('h2', {}, 'Test plan'),
      h('p', { class: 'desc' }, 'Describes what you will test, how, and when testing is done. Everything saves automatically in this browser.'),
      h('div', { class: 'eq' }, field('name', 'Project or release', 'text'), field('owner', 'Test owner or team', 'text')),
      h('div', { class: 'eq' }, field('start', 'Start date', 'date'), field('end', 'End date', 'date')),
      field('objective', 'Objective', 'ta'),
      h('div', { class: 'eq' }, field('inScope', 'In scope', 'ta'), field('outScope', 'Out of scope', 'ta')),
      types,
      field('env', 'Test environments', 'ta'),
      h('div', { class: 'eq' }, field('entry', 'Entry criteria', 'ta'), field('exit', 'Exit criteria', 'ta')),
      field('risks', 'Risks and mitigation', 'ta'));
  }
  function planMd() {
    const p = db.plan, L = (x) => (x && x.trim()) || 'Not set';
    return ['# Test plan: ' + L(p.name), '', '**Owner:** ' + L(p.owner), '**Schedule:** ' + L(p.start) + ' to ' + L(p.end), '',
      '## Objective', L(p.objective), '', '## Scope', '**In scope:** ' + L(p.inScope), '', '**Out of scope:** ' + L(p.outScope), '',
      '## Test types'].concat(p.types.length ? p.types.map((t) => '- ' + t) : ['- Not set'],
      ['', '## Environments', L(p.env), '', '## Entry criteria', L(p.entry), '', '## Exit criteria', L(p.exit), '', '## Risks and mitigation', L(p.risks), '', '## Scenarios and cases'],
      db.scenarios.map((s) => '- ' + s.id + ' ' + s.title + ' (' + s.area + ', ' + PL[s.priority] + '): ' + db.cases.filter((c) => c.scenario === s.id).length + ' cases')).join('\n');
  }
  $('p-copy').addEventListener('click', () => copy(planMd()));
  $('p-dl').addEventListener('click', () => download('test-plan.md', planMd(), 'text/markdown'));

  /* ---------- Scenarios ---------- */
  function renderScen() {
    const list = $('s-list');
    list.replaceChildren(...db.scenarios.map((s) => {
      const n = db.cases.filter((c) => c.scenario === s.id).length;
      return h('li', { class: 'match' },
        h('div', {}, h('strong', {}, s.id + ' ' + s.title), h('div', { class: 'sub' }, s.area + ' · ' + n + (n === 1 ? ' case' : ' cases'))),
        h('div', { class: 'tool-actions' },
          h('span', { class: 'badge sev-' + s.priority }, PL[s.priority]),
          h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Add starter cases to ' + s.id, onclick: () => starters(s) }, 'Add starter cases'),
          h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Delete ' + s.id, onclick: () => delScen(s) }, 'Delete')));
    }));
    if (!db.scenarios.length) list.append(h('li', { class: 'sub' }, 'No scenarios yet. Add one above.'));
  }
  function starters(s) {
    STARTERS.forEach(([t, type, step, exp]) => db.cases.push({ id: nextId(db.cases, 'TC-', 3), scenario: s.id, title: s.title + ': ' + t, type, priority: s.priority, pre: '', steps: step, expected: exp, data: '', status: 'todo', run: null, bug: null }));
    save(); renderAll();
    toast('Added ' + STARTERS.length + ' starter cases. Use Edit to tailor the steps.');
  }
  function delScen(s) {
    const n = db.cases.filter((c) => c.scenario === s.id).length;
    if (!confirm('Delete ' + s.id + (n ? ' and its ' + n + ' test cases?' : '?'))) return;
    db.scenarios = db.scenarios.filter((x) => x !== s);
    db.cases = db.cases.filter((c) => c.scenario !== s.id);
    if (editing && editing.scenario === s.id) endEdit();
    save(); renderAll();
  }
  $('s-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('s-title').value.trim();
    if (!title) { $('s-err').textContent = 'Enter a scenario.'; $('s-title').focus(); return; }
    $('s-err').textContent = '';
    db.scenarios.push({ id: nextId(db.scenarios, 'TS-', 2), title, area: $('s-area').value.trim() || 'General', priority: $('s-pri').value });
    $('s-title').value = ''; $('s-area').value = '';
    save(); renderAll();
  });

  /* ---------- Test cases ---------- */
  function endEdit() {
    editing = null;
    $('c-form').reset();
    $('c-pri').value = 'medium';
    $('c-head').textContent = 'Add a test case';
    $('c-submit').textContent = 'Add test case';
    $('c-cancel').hidden = true;
    $('c-err').textContent = '';
  }
  function startEdit(c) {
    editing = c;
    $('c-title').value = c.title; $('c-scen').value = c.scenario; $('c-type').value = c.type; $('c-pri').value = c.priority;
    $('c-pre').value = c.pre; $('c-steps').value = c.steps; $('c-exp').value = c.expected; $('c-data').value = c.data;
    $('c-head').textContent = 'Edit ' + c.id;
    $('c-submit').textContent = 'Save changes';
    $('c-cancel').hidden = false;
    $('c-form').scrollIntoView({ block: 'start' });
    $('c-title').focus();
  }
  $('c-cancel').addEventListener('click', endEdit);
  $('c-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = { title: $('c-title').value.trim(), scenario: $('c-scen').value, type: $('c-type').value, priority: $('c-pri').value, pre: $('c-pre').value.trim(), steps: $('c-steps').value.trim(), expected: $('c-exp').value.trim(), data: $('c-data').value.trim() };
    const err = !db.scenarios.length ? 'Add a scenario first, then link the case to it.' : !v.title ? 'Enter a title.' : !v.steps ? 'Enter at least one step.' : !v.expected ? 'Enter the expected result.' : '';
    $('c-err').textContent = err;
    if (err) return;
    if (editing) Object.assign(editing, v);
    else db.cases.push(Object.assign({ id: nextId(db.cases, 'TC-', 3), status: 'todo', run: null, bug: null }, v));
    endEdit(); save(); renderAll(); toast('Test case saved');
  });
  function logBug(c) {
    if (!window.BBuddy) return toast('The dashboard isn’t ready yet');
    const id = 'bug' + Date.now().toString(36);
    window.BBuddy.addReport({ id, title: 'Failed ' + c.id + ': ' + c.title, desc: 'Expected: ' + c.expected, severity: c.priority, status: 'open', created: new Date().toISOString() });
    c.bug = id; save(); renderAll(); toast('Bug added to your reports');
  }
  function caseCard(c) {
    const sel = h('select', { class: 'status', 'aria-label': 'Result for ' + c.id });
    opts(sel, Object.entries(ST), c.status);
    sel.addEventListener('change', () => { c.status = sel.value; c.run = c.status === 'todo' ? null : new Date().toISOString(); save(); renderAll(); });
    const bugOpen = c.bug && window.BBuddy && window.BBuddy.getReports().some((r) => r.id === c.bug);
    const det = h('details', {}, h('summary', {}, 'Steps and expected result'), h('div', {},
      c.pre ? h('p', {}, h('strong', {}, 'Before you start: '), c.pre) : null,
      h('strong', {}, 'Steps'),
      h('ol', {}, c.steps.split('\n').filter(Boolean).map((s) => h('li', {}, s))),
      h('p', {}, h('strong', {}, 'Expected result: '), c.expected),
      c.data ? h('p', {}, h('strong', {}, 'Test data: '), c.data) : null));
    if (open.has(c.id)) det.open = true;
    det.addEventListener('toggle', () => { if (det.open) open.add(c.id); else open.delete(c.id); });
    return h('article', { class: 'tcase' },
      h('div', { class: 'tcase-head' },
        h('h3', {}, c.id + ' ' + c.title),
        h('div', { class: 'tool-actions' }, h('span', { class: 'badge sev-' + c.priority }, PL[c.priority]), h('span', { class: 'chip' }, c.type + ' · ' + c.scenario))),
      det,
      h('div', { class: 'tcase-foot' }, sel,
        c.status === 'fail' && !bugOpen ? h('button', { type: 'button', class: 'btn btn-primary sm', onclick: () => logBug(c) }, 'Log bug') : null,
        bugOpen ? h('span', { class: 'chip' }, 'Bug logged in your reports') : null,
        c.run ? h('span', { class: 'chip' }, 'Run ' + new Date(c.run).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) : null,
        h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Edit ' + c.id, onclick: () => startEdit(c) }, 'Edit'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Delete ' + c.id, onclick: () => {
          if (!confirm('Delete ' + c.id + '?')) return;
          if (editing === c) endEdit();
          db.cases = db.cases.filter((x) => x !== c); save(); renderAll();
        } }, 'Delete')));
  }
  function renderCases() {
    const sc = $('c-scen'), cur = sc.value;
    opts(sc, db.scenarios.map((s) => [s.id, s.id + ' ' + s.title]));
    if (db.scenarios.some((s) => s.id === cur)) sc.value = cur;
    const q = $('c-q').value.trim().toLowerCase(), f = $('c-filter').value;
    const rows = db.cases.filter((c) => (f === 'all' || c.status === f) && (!q || (c.id + ' ' + c.title + ' ' + c.scenario).toLowerCase().includes(q)));
    $('c-list').replaceChildren(...rows.map(caseCard));
    if (!rows.length) $('c-list').append(h('p', { class: 'sub' }, db.cases.length ? 'No test cases match your filters.' : 'No test cases yet. Add one above, or use Add starter cases on a scenario.'));
  }
  $('c-q').addEventListener('input', renderCases);
  $('c-filter').addEventListener('change', renderCases);

  /* ---------- Summary ---------- */
  function counts(list) {
    const o = { n: list.length, pass: 0, fail: 0, blocked: 0, todo: 0 };
    list.forEach((c) => { o[c.status]++; });
    return o;
  }
  const pct = (a, b) => (b ? Math.round(a * 100 / b) + '%' : '0%');
  const table = (head, rows) => h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, head.map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((x) => h('td', {}, String(x))))))));
  const byPriority = () => Object.keys(PL).map((p) => { const k = counts(db.cases.filter((c) => c.priority === p)); return [PL[p], k.n, k.pass, k.fail, k.blocked, k.todo]; });
  const bySce = () => db.scenarios.map((s) => { const k = counts(db.cases.filter((c) => c.scenario === s.id)); return [s.id + ' ' + s.title, k.n, k.pass, k.fail, k.n ? 'Covered' : 'No cases']; });
  const failingTop = () => db.cases.filter((c) => c.status === 'fail' && (c.priority === 'critical' || c.priority === 'high')).length;

  function summaryMd() {
    const t = counts(db.cases), ran = t.pass + t.fail;
    const list = (s) => db.cases.filter((c) => c.status === s).map((c) => '- ' + c.id + ' ' + c.title + ' (' + PL[c.priority] + ')');
    const none = (a) => (a.length ? a : ['- None']);
    return ['# Test summary report: ' + (db.plan.name || 'Untitled'), '', 'Date: ' + new Date().toLocaleDateString(), '', '## Results',
      '- Total cases: ' + t.n, '- Executed: ' + ran + ' (' + pct(ran, t.n) + ')', '- Passed: ' + t.pass, '- Failed: ' + t.fail, '- Blocked: ' + t.blocked, '- Not run: ' + t.todo, '- Pass rate: ' + pct(t.pass, ran), '',
      '## By priority', '| Priority | Total | Pass | Fail | Blocked | Not run |', '| --- | --- | --- | --- | --- | --- |']
      .concat(byPriority().map((r) => '| ' + r.join(' | ') + ' |'), ['', '## Failed cases'], none(list('fail')), ['', '## Blocked cases'], none(list('blocked')),
        ['', '## Scenarios without cases'], none(db.scenarios.filter((s) => !db.cases.some((c) => c.scenario === s.id)).map((s) => '- ' + s.id + ' ' + s.title)),
        ['', '## Exit criteria', db.plan.exit || 'Not set']).join('\n');
  }
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    if (!db.cases.length) return toast('No test cases to export');
    const cols = ['id', 'scenario', 'title', 'type', 'priority', 'pre', 'steps', 'expected', 'data', 'status', 'run'];
    download('test-cases.csv', [cols.join(',')].concat(db.cases.map((c) => cols.map((k) => csvCell(c[k])).join(','))).join('\r\n'), 'text/csv');
  }
  function renderSum() {
    const t = counts(db.cases), ran = t.pass + t.fail, top = failingTop();
    const stat = (n, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, n), h('div', { class: 'stat-label' }, l));
    const keys = ['pass', 'fail', 'blocked', 'todo'];
    const note = !t.n ? 'Add test cases to see results.'
      : top ? top + ' Critical or High priority ' + (top === 1 ? 'case is' : 'cases are') + ' failing. Check these against your exit criteria.'
      : 'No Critical or High priority cases are failing.' + (t.todo ? ' ' + t.todo + ' still need running.' : '');
    $('t-sum').replaceChildren(
      h('div', { class: 'stats' }, stat(t.n, 'Test cases'), stat(pct(ran, t.n), 'Executed'), stat(pct(t.pass, ran), 'Pass rate'), stat(t.fail, 'Failing')),
      h('div', { class: 'tool' },
        h('h2', {}, 'Progress'),
        h('div', { class: 'bar', role: 'img', 'aria-label': t.pass + ' passed, ' + t.fail + ' failed, ' + t.blocked + ' blocked, ' + t.todo + ' not run' },
          keys.map((k) => h('i', { class: 'b-' + k, style: 'width:' + (t.n ? t[k] * 100 / t.n : 0) + '%' }))),
        h('div', { class: 'legend' }, keys.map((k) => h('span', {}, h('span', { class: 'dot b-' + k, 'aria-hidden': 'true' }), ST[k] + ': ' + t[k]))),
        h('p', { class: 'stat-line' }, note)),
      h('div', { class: 'tool' }, h('h2', {}, 'By priority'), table(['Priority', 'Total', 'Pass', 'Fail', 'Blocked', 'Not run'], byPriority())),
      h('div', { class: 'tool' }, h('h2', {}, 'Scenario coverage'), db.scenarios.length ? table(['Scenario', 'Cases', 'Pass', 'Fail', 'Coverage'], bySce()) : h('p', { class: 'sub' }, 'No scenarios yet.')),
      h('div', { class: 'tool-actions' },
        h('button', { type: 'button', class: 'btn btn-primary sm', onclick: () => copy(summaryMd()) }, 'Copy summary report'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: exportCsv }, 'Download cases (CSV)'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => {
          if (!confirm('Reset every case to Not run and clear bug links? Your cases stay.')) return;
          db.cases.forEach((c) => { c.status = 'todo'; c.run = null; c.bug = null; });
          save(); renderAll(); toast('New run started');
        } }, 'Start new run')));
  }

  /* ---------- Tabs and navigation ---------- */
  function renderAll() { renderScen(); renderCases(); renderSum(); }
  function setTab(t) {
    Object.keys(panels).forEach((k) => { panels[k].hidden = k !== t; });
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.tab === t)));
    renderAll();
  }
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  const btn = $('test-btn'), toolsBtn = $('tools-btn'), toolsView = $('tools-view');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  function show(on) {
    if (on) {
      reportEls.forEach((el) => { el.style.display = 'none'; });
      if (toolsView) toolsView.style.display = 'none';
      if (toolsBtn) toolsBtn.setAttribute('aria-current', 'false');
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
      renderAll();
    }
    view.style.display = on ? '' : 'none';
    btn.setAttribute('aria-current', String(on));
  }
  btn.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => show(false)));
  if (toolsBtn) toolsBtn.addEventListener('click', () => show(false));
  window.BTesting = { getCases: () => db.cases };
  buildPlan();
  setTab('plan');

  buildPlan();
  setTab('plan');
})();