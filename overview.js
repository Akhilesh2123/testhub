(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);

  /* ---------- Helpers ---------- */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) e.append(c); });
    return e;
  }
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
  function me() {
    try { return sessionStorage.getItem('bbuddy_name') || (sessionStorage.getItem('bbuddy_user') || '').split('@')[0] || ''; }
    catch (e) { return ''; }
  }
  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } };
  const SEV = ['critical', 'high', 'medium', 'low'];
  const SEV_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  const SEV_CLASS = { critical: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low' };

  /* ---------- Page shell ---------- */
  navList.insertAdjacentHTML('afterbegin', '<button class="nav" id="ov-btn">Overview</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="ov-view" style="display:none">
    <header class="top">
      <div><h1>Overview</h1><p class="sub" id="ov-sub"></p></div>
      <div class="tool-actions"><button type="button" class="btn btn-ghost" id="ov-refresh">Refresh</button></div>
    </header>
    <div id="ov-body" class="stack"></div>
  </section>`);
  const view = $('ov-view');

  /* ---------- Data from the other modules ---------- */
  function gather() {
    const reports = safe(() => window.BBuddy.getReports(), []);
    const cases = safe(() => window.BTesting.getCases(), []);
    const issues = safe(() => window.BJira.getIssues(), []);
    const sprints = safe(() => window.BJira.getSprints(), []);
    const today = todayStr(), who = me().trim().toLowerCase();
    const open = reports.filter((r) => r.status !== 'resolved');
    const sev = {}; SEV.forEach((s) => { sev[s] = open.filter((r) => r.severity === s).length; });
    const overdue = open.filter((r) => r.due && r.due < today).sort((a, b) => a.due.localeCompare(b.due));
    const mine = who ? open.filter((r) => String(r.assignee || '').trim().toLowerCase() === who) : [];
    const rc = { pass: 0, fail: 0, blocked: 0, todo: 0 };
    cases.forEach((c) => { rc[Object.prototype.hasOwnProperty.call(rc, c.status) ? c.status : 'todo']++; });
    const ran = rc.pass + rc.fail;
    const hiFail = cases.filter((c) => c.status === 'fail' && (c.priority === 'critical' || c.priority === 'high')).length;
    const sp = sprints.find((s) => s.state === 'active') || null;
    let spInfo = null;
    if (sp) {
      const mem = issues.filter((i) => i.type !== 'epic' && i.type !== 'subtask' && i.sprint === sp.id);
      const total = mem.reduce((a, i) => a + (Number(i.points) || 0), 0);
      const done = mem.filter((i) => i.status === 'done').reduce((a, i) => a + (Number(i.points) || 0), 0);
      const left = sp.end ? Math.ceil((new Date(sp.end + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5) : null;
      spInfo = { sp, n: mem.length, nd: mem.filter((i) => i.status === 'done').length, total, done, left };
    }
    const openIssues = issues.filter((i) => i.type !== 'epic' && i.status !== 'done').length;
    return { reports, open, sev, overdue, mine, rc, cases, ran, hiFail, spInfo, openIssues, issues, who };
  }

  /* ---------- Building blocks ---------- */
  function stat(n, label, hint) {
    return h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, String(n)), h('div', { class: 'stat-label' }, label), hint ? h('div', { class: 'sub ov-hint' }, hint) : null);
  }
  function card(title, ...kids) {
    return h('section', { class: 'card ov-card' }, h('h2', { class: 'ov-h' }, title), kids);
  }
  function go(id) { const b = id === 'all' ? document.querySelector('[data-filter]') : $(id); if (b) b.click(); }
  function bar(parts, label) {
    const total = parts.reduce((a, p) => a + p.n, 0);
    if (!total) return null;
    return h('div', { class: 'ov-bar', role: 'img', 'aria-label': label },
      parts.filter((p) => p.n).map((p) => h('i', { class: 'ov-seg ov-' + p.k, style: 'flex:' + p.n, title: p.l + ': ' + p.n })));
  }
  function legend(items) {
    return h('ul', { class: 'ov-legend' }, items.map((p) => h('li', {}, h('i', { class: 'ov-dot ov-' + p.k, 'aria-hidden': 'true' }), p.l + ' ', h('strong', {}, String(p.n)))));
  }
  function empty(text, label, id) {
    return h('div', { class: 'ov-empty' }, h('p', { class: 'sub' }, text), label ? h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go(id) }, label) : null);
  }
  function bugRow(r) {
    const today = todayStr();
    return h('li', {},
      h('span', { class: 'badge ' + (SEV_CLASS[r.severity] || 'sev-medium') }, SEV_LABEL[r.severity] || 'Medium'),
      h('span', { class: 'ov-t' }, String(r.title || 'Untitled')),
      r.due ? h('span', { class: 'sub ov-d' + (r.due < today ? ' bad' : '') }, (r.due < today ? 'Due ' : 'Due ') + fmtDate(r.due)) : null);
  }

  /* ---------- Render ---------- */
  function verdictOf(d) {
    const crit = d.sev.critical, hasTests = d.cases.length > 0;
    const passRate = pct(d.rc.pass, d.ran);
    const checks = [
      { ok: crit === 0, text: crit === 0 ? 'No open Critical bugs' : plural(crit, 'open Critical bug') },
      { ok: d.hiFail === 0, text: d.hiFail === 0 ? 'No failing Critical or High test cases' : plural(d.hiFail, 'failing Critical or High test case') },
      { ok: hasTests && d.ran > 0 && passRate >= 90, text: !hasTests ? 'No test cases yet' : d.ran === 0 ? 'No test cases have been run' : 'Pass rate ' + passRate + '% (target 90%)' },
      { ok: d.rc.todo === 0 && hasTests, text: !hasTests ? 'Nothing to run yet' : d.rc.todo === 0 ? 'Every test case has been run' : plural(d.rc.todo, 'test case') + ' still to run' }
    ];
    return { checks, ready: checks.every((c) => c.ok) };
  }
  function render() {
    const d = gather();
    const name = me();
    $('ov-sub').textContent = (name ? 'Hello, ' + name + '. ' : '') + 'Here is where your project stands right now.';
    const passRate = pct(d.rc.pass, d.ran);
    const v = verdictOf(d);
    const blocks = [];

    blocks.push(h('div', { class: 'stats' },
      stat(d.open.length, 'Open bugs', d.reports.length ? 'of ' + d.reports.length + ' logged' : 'none logged yet'),
      stat(d.sev.critical + d.sev.high, 'Critical or High', 'open bugs'),
      stat(d.overdue.length, 'Overdue', d.overdue.length ? 'past their due date' : 'nothing late'),
      stat(d.ran ? passRate + '%' : '–', 'Test pass rate', d.ran ? d.ran + ' of ' + d.cases.length + ' run' : 'no runs yet')));

    const attn = d.overdue.length ? d.overdue.slice(0, 5) : [];
    const crit = d.open.filter((r) => r.severity === 'critical' && !attn.includes(r)).slice(0, 5 - attn.length);
    const list = attn.concat(crit);
    blocks.push(h('div', { class: 'ov-grid' },
      card('Needs attention',
        list.length ? h('ul', { class: 'ov-list' }, list.map(bugRow)) : empty(d.reports.length ? 'Nothing is overdue and no Critical bugs are open.' : 'You have not logged any bugs yet.', d.reports.length ? null : 'Log a bug', 'all'),
        d.overdue.length > 5 ? h('p', { class: 'sub' }, '+ ' + (d.overdue.length - 5) + ' more overdue') : null),
      card('Assigned to me',
        !d.who ? empty('Your name isn’t set, so your bugs can’t be matched.')
          : d.mine.length ? h('ul', { class: 'ov-list' }, d.mine.slice(0, 6).map(bugRow)) : empty('No open bugs are assigned to ' + me() + '.'),
        d.mine.length > 6 ? h('p', { class: 'sub' }, '+ ' + (d.mine.length - 6) + ' more') : null)));

    const sevParts = SEV.map((k) => ({ k, l: SEV_LABEL[k], n: d.sev[k] }));
    const testParts = [{ k: 'pass', l: 'Passed', n: d.rc.pass }, { k: 'fail', l: 'Failed', n: d.rc.fail }, { k: 'blocked', l: 'Blocked', n: d.rc.blocked }, { k: 'todo', l: 'Not run', n: d.rc.todo }];
    blocks.push(h('div', { class: 'ov-grid' },
      card('Open bugs by severity', bar(sevParts, 'Open bugs by severity') || empty('No open bugs. Nice.'), d.open.length ? legend(sevParts) : null),
      card('Test results', bar(testParts, 'Test results') || empty('No test cases yet.', 'Open Testing', 'test-btn'), d.cases.length ? legend(testParts) : null)));

    const sp = d.spInfo;
    blocks.push(h('div', { class: 'ov-grid' },
      card('Current sprint',
        sp ? [
          h('p', { class: 'ov-strong' }, sp.sp.name, sp.sp.goal ? h('span', { class: 'sub' }, ' · ' + sp.sp.goal) : null),
          h('div', { class: 'ov-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct(sp.done, sp.total)), 'aria-label': 'Sprint progress' }, h('i', { style: 'width:' + pct(sp.done, sp.total) + '%' })),
          h('p', { class: 'sub' }, sp.done + ' of ' + sp.total + ' points done · ' + sp.nd + ' of ' + plural(sp.n, 'issue') + ' finished' +
            (sp.left == null ? '' : sp.left > 0 ? ' · ' + plural(sp.left, 'day') + ' left' : sp.left === 0 ? ' · ends today' : ' · ' + plural(-sp.left, 'day') + ' past the end date')),
          h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go('jr-btn') }, 'Open board')
        ] : empty(d.issues.length ? 'No sprint is running.' : 'No project work yet.', 'Open Projects', 'jr-btn'),
        d.issues.length ? h('p', { class: 'sub ov-foot' }, plural(d.openIssues, 'open issue') + ' in Projects') : null),
      card('Release quick check',
        h('p', { class: 'ov-verdict' + (v.ready ? ' ok' : '') }, v.ready ? 'Looks ready' : 'Not ready yet'),
        h('ul', { class: 'ov-checks' }, v.checks.map((c) => h('li', { class: c.ok ? 'ok' : 'no' }, h('span', { class: 'ov-mark', 'aria-hidden': 'true' }, c.ok ? '✓' : '✗'), h('span', { class: 'sr-only' }, c.ok ? 'Pass: ' : 'Fail: '), c.text))),
        h('p', { class: 'sub ov-foot' }, 'A quick guide only. The Release page holds the full sign-off.'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go('rl-btn') }, 'Open Release'))));

    blocks.push(h('div', { class: 'tool-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go('all') }, 'All bug reports'),
      h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go('test-btn') }, 'Testing'),
      h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go('jr-btn') }, 'Projects'),
      h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => go('ws-btn') }, 'Code workspace')));

    $('ov-body').replaceChildren(...blocks);
  }

  /* ---------- Show / hide with the other modules ---------- */
  const btn = $('ov-btn');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  const others = ['tools', 'test', 'au', 'hs', 'rl', 'jr', 'ws'];
  const otherViews = ['tools-view', 'test-view', 'auto-view', 'hist-view', 'rel-view', 'jira-view', 'ws-view'];
  function show(on) {
    if (on) {
      reportEls.forEach((el) => { el.style.display = 'none'; });
      otherViews.forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
      others.forEach((p) => { const b = $(p + '-btn'); if (b) b.setAttribute('aria-current', 'false'); });
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
      render();
    }
    view.style.display = on ? '' : 'none';
    btn.setAttribute('aria-current', String(on));
  }
  btn.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => show(false)));
  others.forEach((p) => { const b = $(p + '-btn'); if (b) b.addEventListener('click', () => show(false)); });
  $('ov-refresh').addEventListener('click', render);
  window.addEventListener('focus', () => { if (view.style.display !== 'none') render(); });
})();