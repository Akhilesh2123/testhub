(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'bbuddy_hist';
  const MAX_RUNS = 50, MAX_RES = 30;
  const ST = { pass: 'Pass', fail: 'Fail', blocked: 'Blocked', todo: 'Not run' };
  const CAUSES = ['Unknown', 'Timing or waits', 'Test data', 'Environment', 'Selector changes', 'Network or API', 'Order dependency'];
  const FIXES = [
    ['Timing or waits', 'Wait for a visible element or a response instead of using a fixed pause.'],
    ['Test data', 'Create fresh data for each test and clean it up afterwards.'],
    ['Environment', 'Pin versions, reset the app state and run in a clean container.'],
    ['Selector changes', 'Use stable test IDs or accessible roles instead of layout-based selectors.'],
    ['Network or API', 'Mock unreliable services and retry only the call, not the whole test.'],
    ['Order dependency', 'Make each test set up its own state so it passes in any order.']
  ];
  const BADGE = { 'Flaky': 'sev-high', 'Failing every time': 'sev-critical', 'Stable': 'sev-low', 'Not enough data': 'sev-medium' };

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
  function opts(sel, pairs) { sel.replaceChildren(...pairs.map(([v, t]) => h('option', { value: v }, t))); }
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
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  const cell = (s) => String(s).replace(/\|/g, '/');
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const cases = () => (window.BTesting ? window.BTesting.getCases() : []);

  /* ---------- Saved data ---------- */
  let db = { runs: [], flaky: [] };
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.runs) && Array.isArray(d.flaky)) db = d;
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

  /* ---------- Markup ---------- */
  navList.insertAdjacentHTML('beforeend', '<button class="nav" id="hs-btn">History</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="hist-view" style="display:none">
    <header class="top"><div><h1>History and flaky tests</h1><p class="sub">Save test runs to see trends and compare cycles, and track tests that pass and fail at random.</p></div></header>
    <div class="tabs">
      <button type="button" class="tab" data-ht="runs">Run history</button>
      <button type="button" class="tab" data-ht="flaky">Flaky tests</button>
    </div>

    <div id="hs-runs" class="stack">
      <div class="stats" id="hs-stats"></div>
      <div class="tool">
        <h2>Save the current results as a run</h2>
        <p class="desc">Takes a snapshot of every test case result in the Testing section. Save a run before you use Start new run there, because that button clears the results.</p>
        <div class="eq">
          <div class="field"><label for="hs-name">Run name</label><input class="input" id="hs-name" maxlength="60" placeholder="Sprint 12 regression"></div>
          <div class="field"><label for="hs-build">Build or version (optional)</label><input class="input" id="hs-build" maxlength="40" placeholder="v1.4.2"></div>
        </div>
        <p class="error" id="hs-err"></p>
        <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="hs-save">Save run</button></div>
      </div>
      <div class="tool"><h2>Pass rate trend</h2><div class="trend" id="hs-trend"></div></div>
      <div class="tool">
        <h2>Compare two runs</h2>
        <p class="desc">See what broke, what was fixed and what is still failing between two cycles.</p>
        <div class="eq">
          <div class="field"><label for="hs-a">Earlier run</label><select class="input" id="hs-a"></select></div>
          <div class="field"><label for="hs-b">Later run</label><select class="input" id="hs-b"></select></div>
        </div>
        <div id="hs-cmp" aria-live="polite"></div>
      </div>
      <div class="stack" id="hs-list"></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-primary sm" id="hs-md">Copy history as Markdown</button>
        <button type="button" class="btn btn-ghost sm" id="hs-csv">Download history (CSV)</button>
      </div>
    </div>

    <div id="hs-flaky" class="stack" hidden>
      <div class="stats" id="hf-stats"></div>
      <div class="tool">
        <h2>Spotted in your run history</h2>
        <p class="desc">Test cases that switched between pass and fail across three or more saved runs.</p>
        <ul class="matches" id="hf-detect"></ul>
      </div>
      <form class="tool" id="hf-form" novalidate>
        <h2>Track a test</h2>
        <p class="desc">Add an automated test by name, then log each run result. A test is flaky when it both passes and fails with no code change.</p>
        <div class="eq">
          <div class="field"><label for="hf-name">Test name</label><input class="input" id="hf-name" maxlength="140" list="hf-names" placeholder="Checkout: pay with saved card"><datalist id="hf-names"></datalist></div>
          <div class="field"><label for="hf-cause">Suspected cause</label><select class="input" id="hf-cause"></select></div>
        </div>
        <p class="error" id="hf-err"></p>
        <div class="tool-actions"><button type="submit" class="btn btn-primary sm">Start tracking</button></div>
      </form>
      <div class="stack" id="hf-list"></div>
      <div class="tool"><h2>Common causes and fixes</h2><ul class="matches" id="hf-fix"></ul></div>
      <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="hf-copy">Copy flaky test report</button></div>
    </div>
  </section>`);
  opts($('hf-cause'), CAUSES.map((c) => [c, c]));
  $('hf-fix').replaceChildren(...FIXES.map(([c, t]) => h('li', { class: 'match' }, h('div', {}, h('strong', {}, c), h('div', { class: 'sub' }, t)))));

  /* ---------- Run history ---------- */
  function tally(list) {
    const o = { pass: 0, fail: 0, blocked: 0, todo: 0 };
    list.forEach((c) => { o[c.status in o ? c.status : 'todo']++; });
    return o;
  }
  function rate(r) {
    const ran = r.c.pass + r.c.fail;
    return ran ? Math.round(r.c.pass * 100 / ran) : null;
  }
  const stat = (n, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, n), h('div', { class: 'stat-label' }, l));

  $('hs-save').addEventListener('click', () => {
    const list = cases(), err = $('hs-err');
    err.textContent = '';
    if (!window.BTesting || !list.length) { err.textContent = 'Add test cases in the Testing section first.'; return; }
    const c = tally(list);
    if (c.pass + c.fail === 0) { err.textContent = 'Mark at least one case as Pass or Fail before saving a run.'; return; }
    db.runs.push({
      id: uid('r'),
      name: $('hs-name').value.trim() || 'Run ' + (db.runs.length + 1),
      build: $('hs-build').value.trim(),
      date: new Date().toISOString(),
      c,
      cases: list.map((x) => [x.id, x.title, x.status, x.priority])
    });
    if (db.runs.length > MAX_RUNS) db.runs.shift();
    $('hs-name').value = ''; $('hs-build').value = '';
    save(); renderRuns(); renderFlaky(); toast('Run saved');
  });

  function drawCmp() {
    const root = $('hs-cmp'), runs = db.runs;
    if (runs.length < 2) { root.replaceChildren(h('p', { class: 'sub' }, 'Save at least two runs to compare them.')); return; }
    const a = runs[+$('hs-a').value], b = runs[+$('hs-b').value];
    if (!a || !b) return;
    if (a === b) { root.replaceChildren(h('p', { class: 'sub' }, 'Choose two different runs.')); return; }
    const A = new Map(a.cases.map((x) => [x[0], x])), B = new Map(b.cases.map((x) => [x[0], x]));
    const reg = [], fixed = [], still = [], added = [], removed = [];
    B.forEach((x, id) => {
      const y = A.get(id);
      if (!y) added.push(x);
      else if (y[2] === 'pass' && x[2] === 'fail') reg.push(x);
      else if (y[2] === 'fail' && x[2] === 'pass') fixed.push(x);
      else if (y[2] === 'fail' && x[2] === 'fail') still.push(x);
    });
    A.forEach((y, id) => { if (!B.has(id)) removed.push(y); });
    const sec = (title, arr, withStatus) => h('div', {}, h('h3', {}, title + ' (' + arr.length + ')'),
      arr.length ? h('ul', {}, arr.map((x) => h('li', {}, x[0] + ' ' + x[1] + (withStatus ? ' (' + ST[x[2]] + ')' : ''))))
        : h('p', { class: 'sub' }, 'None'));
    root.replaceChildren(h('div', { class: 'cmp' }, sec('Newly failing', reg), sec('Fixed', fixed), sec('Still failing', still), sec('New cases', added, true), sec('Removed cases', removed, true)));
  }
  $('hs-a').addEventListener('change', drawCmp);
  $('hs-b').addEventListener('change', drawCmp);

  function renderRuns() {
    const runs = db.runs, last = runs[runs.length - 1], prev = runs[runs.length - 2];
    const lr = last ? rate(last) : null, pr = prev ? rate(prev) : null;
    const delta = lr != null && pr != null ? (lr - pr > 0 ? '+' : '') + (lr - pr) + ' pts' : '–';
    $('hs-stats').replaceChildren(stat(runs.length, 'Runs saved'), stat(lr == null ? '–' : lr + '%', 'Latest pass rate'), stat(delta, 'Change since previous'), stat(last ? last.c.fail : '–', 'Failing in latest run'));

    $('hs-trend').replaceChildren(...(runs.length ? runs.slice(-10).map((r) => {
      const v = rate(r);
      return h('div', { class: 'trow' }, h('span', { class: 'lbl', title: r.name }, r.name),
        h('div', { class: 'track', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (v || 0) + '%' })),
        h('b', {}, v == null ? 'n/a' : v + '%'));
    }) : [h('p', { class: 'sub' }, 'Save your first run to see the trend.')]));

    const pairs = runs.map((r, i) => [String(i), r.name + ' (' + fmtDate(r.date) + ')']);
    const a = $('hs-a'), b = $('hs-b'), av = a.value, bv = b.value;
    opts(a, pairs); opts(b, pairs);
    a.value = pairs.some((p) => p[0] === av) ? av : String(Math.max(0, runs.length - 2));
    b.value = pairs.some((p) => p[0] === bv) ? bv : String(Math.max(0, runs.length - 1));
    drawCmp();

    $('hs-list').replaceChildren(...runs.slice().reverse().map((r) => {
      const v = rate(r);
      return h('article', { class: 'tcase' },
        h('div', { class: 'tcase-head' }, h('h3', {}, r.name), h('span', { class: 'chip' }, fmtDate(r.date) + (r.build ? ' · ' + r.build : ''))),
        h('div', { class: 'tcase-foot' },
          h('span', { class: 'chip' }, 'Pass ' + r.c.pass + ' · Fail ' + r.c.fail + ' · Blocked ' + r.c.blocked + ' · Not run ' + r.c.todo + ' · Pass rate ' + (v == null ? 'n/a' : v + '%')),
          h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Delete ' + r.name, onclick: () => {
            if (!confirm('Delete this saved run?')) return;
            db.runs = db.runs.filter((x) => x !== r);
            save(); renderRuns(); renderFlaky();
          } }, 'Delete')));
    }));
  }
  $('hs-md').addEventListener('click', () => {
    if (!db.runs.length) return toast('No runs saved yet');
    copy(['# Test run history', '', '| Run | Date | Build | Pass | Fail | Blocked | Not run | Pass rate |', '| --- | --- | --- | --- | --- | --- | --- | --- |']
      .concat(db.runs.map((r) => { const v = rate(r); return '| ' + [cell(r.name), fmtDate(r.date), cell(r.build || '-'), r.c.pass, r.c.fail, r.c.blocked, r.c.todo, v == null ? 'n/a' : v + '%'].join(' | ') + ' |'; })).join('\n'));
  });
  $('hs-csv').addEventListener('click', () => {
    if (!db.runs.length) return toast('No runs saved yet');
    const head = ['run', 'build', 'date', 'pass', 'fail', 'blocked', 'not_run', 'pass_rate'];
    download('run-history.csv', [head.join(',')].concat(db.runs.map((r) => { const v = rate(r); return [r.name, r.build, r.date, r.c.pass, r.c.fail, r.c.blocked, r.c.todo, v == null ? '' : v + '%'].map(csvCell).join(','); })).join('\r\n'), 'text/csv');
  });

  /* ---------- Flaky tests ---------- */
  const switches = (a) => { let n = 0; for (let i = 1; i < a.length; i++) if (a[i] !== a[i - 1]) n++; return n; };
  function info(r) {
    const l = r.results.slice(-20), f = l.filter((x) => x === 'f').length, p = l.length - f;
    const label = l.length < 3 ? 'Not enough data' : f === 0 ? 'Stable' : p === 0 ? 'Failing every time' : 'Flaky';
    return { l, f, p, label, rate: l.length ? Math.round(f * 100 / l.length) : 0 };
  }
  function history() {
    const m = new Map();
    db.runs.forEach((r) => r.cases.forEach(([id, title, s]) => {
      if (s !== 'pass' && s !== 'fail') return;
      if (!m.has(id)) m.set(id, { title, seq: [] });
      const o = m.get(id); o.title = title; o.seq.push(s === 'pass' ? 'p' : 'f');
    }));
    return m;
  }
  const isTracked = (name) => db.flaky.some((r) => r.name.toLowerCase() === name.toLowerCase());
  function track(name, cause, results) {
    db.flaky.push({ id: uid('f'), name, cause, quarantined: false, results: results.slice(-MAX_RES) });
    save(); renderFlaky();
  }
  function logResult(r, v) {
    r.results.push(v);
    if (r.results.length > MAX_RES) r.results.shift();
    save(); renderFlaky();
  }

  $('hf-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('hf-name').value.trim(), err = $('hf-err');
    if (!name) { err.textContent = 'Enter a test name.'; $('hf-name').focus(); return; }
    if (isTracked(name)) { err.textContent = 'That test is already being tracked.'; return; }
    err.textContent = '';
    track(name, $('hf-cause').value, []);
    $('hf-name').value = '';
  });

  function flakeCard(r) {
    const i = info(r);
    const cause = h('select', { class: 'status', 'aria-label': 'Cause for ' + r.name });
    opts(cause, CAUSES.map((c) => [c, c])); cause.value = r.cause;
    cause.addEventListener('change', () => { r.cause = cause.value; save(); });
    const q = h('input', { type: 'checkbox' }); q.checked = r.quarantined;
    q.addEventListener('change', () => { r.quarantined = q.checked; save(); renderFlaky(); });
    const strip = i.l.length
      ? h('div', { class: 'strip', role: 'img', 'aria-label': 'Last ' + i.l.length + ' results: ' + i.l.map((x) => (x === 'p' ? 'pass' : 'fail')).join(', ') },
        i.l.map((x) => h('span', { class: x, 'aria-hidden': 'true' }, x.toUpperCase())))
      : h('span', { class: 'chip' }, 'No results logged yet.');
    const bug = i.label === 'Flaky' || i.label === 'Failing every time';
    return h('article', { class: 'tcase' },
      h('div', { class: 'tcase-head' }, h('h3', {}, r.name),
        h('div', { class: 'tool-actions' }, h('span', { class: 'badge ' + BADGE[i.label] }, i.label), r.quarantined ? h('span', { class: 'chip' }, 'Quarantined') : null)),
      strip,
      h('div', { class: 'tcase-foot' },
        h('span', { class: 'chip' }, i.l.length ? 'Failed ' + i.f + ' of last ' + i.l.length + ' (' + i.rate + '%)' : ''),
        cause,
        h('label', { class: 'opt' }, q, 'Quarantined')),
      h('div', { class: 'tcase-foot' },
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => logResult(r, 'p') }, 'Log pass'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => logResult(r, 'f') }, 'Log fail'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => { r.results.pop(); save(); renderFlaky(); } }, 'Undo last'),
        bug ? h('button', { type: 'button', class: 'btn btn-primary sm', onclick: () => {
          if (!window.BBuddy) return toast('The dashboard isn’t ready yet');
          window.BBuddy.addReport({ id: uid('bug'), title: (i.label === 'Flaky' ? 'Flaky test: ' : 'Failing test: ') + r.name, desc: 'Failed ' + i.f + ' of the last ' + i.l.length + ' runs. Suspected cause: ' + r.cause + '.', severity: 'medium', status: 'open', created: new Date().toISOString() });
          toast('Added to your bug reports');
        } }, 'Add to bug reports') : null,
        h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Delete ' + r.name, onclick: () => {
          if (!confirm('Stop tracking this test?')) return;
          db.flaky = db.flaky.filter((x) => x !== r); save(); renderFlaky();
        } }, 'Delete')));
  }

  function renderFlaky() {
    const infos = db.flaky.map(info);
    const flaky = infos.filter((x) => x.label === 'Flaky').length;
    const all = infos.reduce((a, x) => a + x.l.length, 0), fails = infos.reduce((a, x) => a + x.f, 0);
    $('hf-stats').replaceChildren(stat(db.flaky.length, 'Tests tracked'), stat(flaky, 'Flaky'), stat(db.flaky.filter((r) => r.quarantined).length, 'Quarantined'), stat(all ? Math.round(fails * 100 / all) + '%' : '–', 'Failure rate'));

    const cand = [];
    history().forEach((o, id) => {
      const name = id + ' ' + o.title;
      if (o.seq.length >= 3 && o.seq.includes('p') && o.seq.includes('f') && switches(o.seq) >= 2 && !isTracked(name)) cand.push({ name, seq: o.seq });
    });
    $('hf-detect').replaceChildren(...(!db.runs.length ? [h('li', { class: 'sub' }, 'Save a few runs first, then inconsistent test cases show up here.')]
      : !cand.length ? [h('li', { class: 'sub' }, 'No test case has switched between pass and fail in three or more runs.')]
      : cand.map((c) => h('li', { class: 'match' },
        h('div', {}, h('strong', {}, c.name), h('div', { class: 'sub' }, 'Switched result ' + switches(c.seq) + ' times in ' + c.seq.length + ' runs')),
        h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Track ' + c.name, onclick: () => track(c.name, 'Unknown', c.seq) }, 'Track')))));

    $('hf-names').replaceChildren(...cases().map((c) => h('option', { value: c.id + ' ' + c.title })));
    $('hf-list').replaceChildren(...(db.flaky.length ? db.flaky.map(flakeCard) : [h('p', { class: 'sub' }, 'No tests tracked yet. Add one above, or track one spotted from your run history.')]));
  }
  $('hf-copy').addEventListener('click', () => {
    if (!db.flaky.length) return toast('No tests tracked yet');
    copy(['## Flaky test report', '', '| Test | Status | Failure rate | Suspected cause | Quarantined |', '| --- | --- | --- | --- | --- |']
      .concat(db.flaky.map((r) => { const i = info(r); return '| ' + [cell(r.name), i.label, i.l.length ? i.rate + '%' : 'n/a', r.cause, r.quarantined ? 'Yes' : 'No'].join(' | ') + ' |'; })).join('\n'));
  });

  /* ---------- Tabs and navigation ---------- */
  const P = { runs: $('hs-runs'), flaky: $('hs-flaky') };
  function setTab(t) {
    Object.keys(P).forEach((k) => { P[k].hidden = k !== t; });
    document.querySelectorAll('[data-ht]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.ht === t)));
    if (t === 'runs') renderRuns(); else renderFlaky();
  }
  document.querySelectorAll('[data-ht]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.ht)));

  const view = $('hist-view'), btn = $('hs-btn');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  const others = ['tools', 'test', 'au'];
  function show(on) {
    if (on) {
      reportEls.forEach((el) => { el.style.display = 'none'; });
      ['tools-view', 'test-view', 'auto-view'].forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
      others.forEach((p) => { const b = $(p + '-btn'); if (b) b.setAttribute('aria-current', 'false'); });
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
      const active = document.querySelector('[data-ht][aria-current="true"]');
      setTab(active ? active.dataset.ht : 'runs');
    }
    view.style.display = on ? '' : 'none';
    btn.setAttribute('aria-current', String(on));
  }
  btn.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => show(false)));
  others.forEach((p) => { const b = $(p + '-btn'); if (b) b.addEventListener('click', () => show(false)); });

  setTab('runs');
})();