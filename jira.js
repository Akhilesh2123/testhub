(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'bbuddy_jira';

  /* ---------- The model ---------- */
  const TYPES = { epic: ['Epic', 'E'], story: ['Story', 'S'], task: ['Task', 'T'], bug: ['Bug', 'B'], subtask: ['Sub-task', 'ST'] };
  const WORK = ['story', 'task', 'bug'];
  const STATUS = { todo: 'To do', progress: 'In progress', review: 'In review', done: 'Done' };
  const COLS = Object.keys(STATUS);
  const FLOW = { todo: ['progress'], progress: ['todo', 'review', 'done'], review: ['progress', 'done'], done: ['todo', 'progress'] };
  const PRI = { highest: 'Highest', high: 'High', medium: 'Medium', low: 'Low', lowest: 'Lowest' };
  const PB = { highest: 'sev-critical', high: 'sev-high', medium: 'sev-medium', low: 'sev-low', lowest: 'sev-low' };
  const OUT = { blocks: 'blocks', duplicates: 'duplicates', relates: 'relates to' };
  const IN = { blocks: 'is blocked by', duplicates: 'is duplicated by', relates: 'relates to' };
  const SEV2PRI = { critical: 'highest', high: 'high', medium: 'medium', low: 'low' };
  const REP2ST = { open: 'todo', progress: 'progress', resolved: 'done' };

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
  function put(root, ...kids) { root.replaceChildren(...kids.flat().filter((k) => k != null && k !== false)); }
  function opts(sel, pairs, val) {
    sel.replaceChildren(...pairs.map(([v, t]) => h('option', { value: v }, t)));
    if (val != null && pairs.some((p) => p[0] === val)) sel.value = val;
  }
  function toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 3000);
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
  function author() {
    try { return sessionStorage.getItem('bbuddy_name') || (sessionStorage.getItem('bbuddy_user') || 'You').split('@')[0]; }
    catch (e) { return 'You'; }
  }
  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const nat = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const today = () => new Date().toISOString().slice(0, 10);
  const fmt = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
  const stamp = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /* ---------- Data ---------- */
  function seed() {
    const d = { v: 1, key: 'BBD', name: 'Bug Reporting Buddy', n: 0, sn: 0, issues: [], sprints: [] };
    const now = Date.now(), day = 864e5, me = author();
    const iso = (o) => new Date(now + o * day).toISOString();
    const date = (o) => iso(o).slice(0, 10);
    const sp = (name, goal, state, s, e) => { d.sn++; const o = { id: 'sp' + d.sn, name, goal, state, start: s, end: e }; d.sprints.push(o); return o.id; };
    const add = (type, title, o) => {
      d.n++;
      const i = Object.assign({ id: d.key + '-' + d.n, type, title, desc: '', status: 'todo', priority: 'medium', assignee: '', reporter: me, points: 0, labels: [], parent: null, sprint: null, links: [], comments: [], log: [], created: iso(-6), updated: iso(-1), src: null }, o || {});
      i.log.push({ at: i.created, by: me, text: 'Created' });
      d.issues.push(i);
      return i.id;
    };
    const s1 = sp('Sprint 1', 'Ship sign-in and the bug list', 'active', date(-4), date(10));
    const s2 = sp('Sprint 2', 'Testing and release tools', 'planned', '', '');
    const eAuth = add('epic', 'Authentication', { priority: 'high', desc: 'Everything about getting people signed in safely.' });
    const eBug = add('epic', 'Bug tracking', { priority: 'high' });
    const eRel = add('epic', 'Release readiness', {});
    const sIn = add('story', 'As a user I can sign in', { points: 5, status: 'review', priority: 'high', assignee: me, parent: eAuth, sprint: s1, labels: ['auth'] });
    const sReset = add('story', 'As a user I can reset my password', { points: 5, status: 'progress', assignee: me, parent: eAuth, sprint: s1, labels: ['auth'] });
    add('story', 'As a user I can create an account', { points: 3, status: 'done', parent: eAuth, sprint: s1, assignee: me });
    add('subtask', 'Build the code entry step', { status: 'done', parent: sReset, assignee: me });
    add('subtask', 'Add a resend button', { status: 'todo', parent: sReset });
    const bDark = add('bug', 'Dark mode hides the search icon', { priority: 'medium', points: 2, parent: eBug, sprint: s1, labels: ['ui'] });
    add('bug', 'Profile photo upload fails above 5 MB', { priority: 'high', points: 3, status: 'progress', parent: eBug, sprint: s1, assignee: me });
    const tCi = add('task', 'Set up the CI pipeline', { points: 3, sprint: s2, priority: 'low' });
    add('story', 'As a tester I can attach screenshots to bugs', { points: 8, parent: eBug, sprint: s2, priority: 'high' });
    add('story', 'As a lead I can print a release sign-off sheet', { points: 5, parent: eRel });
    add('bug', 'Typo on the pricing page', { priority: 'lowest', points: 1 });
    d.issues.find((i) => i.id === tCi).links.push({ type: 'blocks', to: bDark });
    return d;
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 1 && Array.isArray(d.issues) && Array.isArray(d.sprints)) {
        d.issues.forEach((i) => { ['labels', 'links', 'comments', 'log'].forEach((k) => { if (!Array.isArray(i[k])) i[k] = []; }); });
        return d;
      }
    } catch (e) {}
    return seed();
  }
  let db = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('Couldn’t save: your browser storage is full.'); return false; }
  }

  try { if (!localStorage.getItem(KEY)) save(); } catch (e) {}

  const byId = (id) => db.issues.find((i) => i.id === id);
  const kids = (id) => db.issues.filter((i) => i.parent === id);
  const sprintById = (id) => db.sprints.find((s) => s.id === id);
  const active = () => db.sprints.find((s) => s.state === 'active');
  const sprintOf = (i) => { if (i.type === 'subtask') { const p = byId(i.parent); return p ? p.sprint : null; } return i.sprint; };
  const epicOf = (i) => { if (i.type === 'epic') return null; const p = i.type === 'subtask' ? byId(i.parent) : i; return p ? p.parent : null; };
  const pts = (i) => (i.type === 'epic' || i.type === 'subtask' ? 0 : (+i.points || 0));
  const blockers = (i) => db.issues.filter((x) => x.status !== 'done' && x.links.some((l) => l.type === 'blocks' && l.to === i.id));
  function log(i, text) {
    i.log.push({ at: new Date().toISOString(), by: author(), text });
    if (i.log.length > 50) i.log.shift();
    i.updated = new Date().toISOString();
  }
  function sstats(id) {
    const l = db.issues.filter((i) => i.type !== 'epic' && i.type !== 'subtask' && sprintOf(i) === id);
    const done = l.filter((i) => i.status === 'done');
    return { l, n: l.length, nd: done.length, total: l.reduce((a, i) => a + pts(i), 0), done: done.reduce((a, i) => a + pts(i), 0) };
  }
  function daysLeft(s) { return s.end ? Math.ceil((new Date(s.end + 'T23:59:59') - Date.now()) / 864e5) : null; }

  /* ---------- Workflow ---------- */
  function checkMove(i, to) {
    if (i.status === to) return '';
    if (FLOW[i.status].indexOf(to) === -1) {
      return 'From ' + STATUS[i.status] + ' an issue can only move to ' + FLOW[i.status].map((s) => STATUS[s]).join(' or ') + '.';
    }
    if (to === 'done') {
      const open = kids(i.id).filter((k) => k.type === 'subtask' && k.status !== 'done').length;
      if (open) return 'Finish the ' + plural(open, 'open sub-task') + ' first.';
    }
    return '';
  }
  function move(i, to) {
    const bad = checkMove(i, to);
    if (bad) { toast(bad); return false; }
    if (i.status === to) return true;
    log(i, 'Status: ' + STATUS[i.status] + ' to ' + STATUS[to]);
    i.status = to;
    save();
    return true;
  }

  /* ---------- Page shell ---------- */
  navList.insertAdjacentHTML('beforeend', '<button class="nav" id="jr-btn">Projects</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="jira-view" style="display:none">
    <header class="top">
      <div><h1>Projects</h1><p class="sub" id="jr-sub"></p></div>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost" id="jr-pj-btn">Project settings</button>
        <button type="button" class="btn btn-primary" id="jr-new">Create issue</button>
      </div>
    </header>
    <div class="stats" id="jr-stats"></div>
    <div class="tabs">
      <button type="button" class="tab" data-jt="board">Board</button>
      <button type="button" class="tab" data-jt="backlog">Backlog</button>
      <button type="button" class="tab" data-jt="issues">All issues</button>
      <button type="button" class="tab" data-jt="epics">Epics</button>
    </div>
    <div class="jr-bar" id="jr-filters" style="margin-bottom:16px">
      <div class="field"><label for="jr-fq">Search</label><input class="input" id="jr-fq" type="search" placeholder="Key, title or label"></div>
      <div class="field"><label for="jr-fwho">Assignee</label><select class="input" id="jr-fwho"></select></div>
      <div class="field"><label for="jr-ftype">Type</label><select class="input" id="jr-ftype"></select></div>
      <div class="field"><label for="jr-fepic">Epic</label><select class="input" id="jr-fepic"></select></div>
      <div class="field" id="jr-sortf"><label for="jr-fsort">Sort by</label>
        <select class="input" id="jr-fsort"><option value="updated">Recently updated</option><option value="priority">Priority</option><option value="key">Key</option></select></div>
    </div>
    <div id="jr-board" class="stack"></div>
    <div id="jr-backlog" class="stack"></div>
    <div id="jr-issues" class="stack"></div>
    <div id="jr-epics" class="stack"></div>
  </section>`);

  document.body.insertAdjacentHTML('beforeend', `
  <dialog id="jr-dlg" aria-labelledby="jr-dh">
    <div class="dlg-body">
      <div class="jr-dhead"><h2 id="jr-dh"></h2><button type="button" class="btn btn-ghost sm" id="jr-x">Close</button></div>
      <div class="jr-dg">
        <div class="stack">
          <div class="field"><label for="jr-title">Title</label><input class="input" id="jr-title" maxlength="140"></div>
          <div class="field"><label for="jr-desc">Description</label><textarea class="input" id="jr-desc" rows="5" maxlength="3000"></textarea></div>
          <div class="stack" id="jr-extra"></div>
        </div>
        <div class="stack">
          <div class="field"><label for="jr-type">Type</label><select class="input" id="jr-type"></select></div>
          <div class="field" id="jr-status-row"><label for="jr-status">Status</label><select class="input" id="jr-status"></select></div>
          <div class="field"><label for="jr-pri">Priority</label><select class="input" id="jr-pri"></select></div>
          <div class="field"><label for="jr-who">Assignee</label><input class="input" id="jr-who" maxlength="60" list="jr-names" placeholder="Unassigned"><datalist id="jr-names"></datalist></div>
          <div class="field" id="jr-pts-row"><label for="jr-pts">Story points</label><input class="input" id="jr-pts" type="number" min="0" max="100" step="1"></div>
          <div class="field" id="jr-sprint-row"><label for="jr-sprint">Sprint</label><select class="input" id="jr-sprint"></select></div>
          <div class="field" id="jr-parent-row"><label for="jr-parent" id="jr-parent-label">Epic</label><select class="input" id="jr-parent"></select></div>
          <div class="field"><label for="jr-labels">Labels</label><input class="input" id="jr-labels" maxlength="120" placeholder="ui, auth"></div>
          <p class="stat-line" id="jr-meta"></p>
        </div>
      </div>
      <p class="error" id="jr-derr" role="alert"></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-primary sm" id="jr-save">Save</button>
        <button type="button" class="btn btn-ghost sm" id="jr-del">Delete issue</button>
      </div>
    </div>
  </dialog>

  <dialog id="jr-sp" aria-labelledby="jr-sph">
    <form class="dlg-body" id="jr-spf" novalidate>
      <h2 id="jr-sph" style="margin-bottom:16px"></h2>
      <div class="field"><label for="jr-spn">Sprint name</label><input class="input" id="jr-spn" maxlength="60"></div>
      <div class="field"><label for="jr-spg">Sprint goal (optional)</label><input class="input" id="jr-spg" maxlength="160"></div>
      <div class="eq">
        <div class="field"><label for="jr-sps">Start date</label><input class="input" id="jr-sps" type="date"></div>
        <div class="field"><label for="jr-spe">End date</label><input class="input" id="jr-spe" type="date"></div>
      </div>
      <p class="error" id="jr-sperr" role="alert"></p>
      <div class="dlg-actions"><button type="button" class="btn btn-ghost sm" id="jr-spx">Cancel</button><button type="submit" class="btn btn-primary sm">Save sprint</button></div>
    </form>
  </dialog>

  <dialog id="jr-sd" aria-labelledby="jr-sdh">
    <form class="dlg-body" id="jr-sdf">
      <h2 id="jr-sdh" style="margin-bottom:10px">Complete sprint</h2>
      <p class="sub" id="jr-sdt" style="margin-bottom:14px"></p>
      <div class="field"><label for="jr-sdto">Move unfinished issues to</label><select class="input" id="jr-sdto"></select></div>
      <div class="dlg-actions"><button type="button" class="btn btn-ghost sm" id="jr-sdx">Cancel</button><button type="submit" class="btn btn-primary sm">Complete sprint</button></div>
    </form>
  </dialog>

  <dialog id="jr-pj" aria-labelledby="jr-pjh">
    <form class="dlg-body" id="jr-pjf" novalidate>
      <h2 id="jr-pjh" style="margin-bottom:16px">Project settings</h2>
      <div class="field"><label for="jr-pjn">Project name</label><input class="input" id="jr-pjn" maxlength="60"></div>
      <div class="field"><label for="jr-pjk">Project key</label><input class="input" id="jr-pjk" maxlength="5">
        <p class="stat-line" id="jr-pjkh"></p></div>
      <p class="error" id="jr-pjerr" role="alert"></p>
      <div class="dlg-actions" style="justify-content:space-between">
        <button type="button" class="btn btn-ghost sm" id="jr-pjclear">Delete all issues and sprints</button>
        <span style="display:flex;gap:10px"><button type="button" class="btn btn-ghost sm" id="jr-pjx">Close</button><button type="submit" class="btn btn-primary sm">Save</button></span>
      </div>
    </form>
  </dialog>`);

  const view = $('jira-view');
  const dlg = $('jr-dlg');
  let tab = 'board';
  const F = { q: '', who: '', type: '', epic: '', sort: 'updated' };

  /* ---------- Small building blocks ---------- */
  function typeBadge(i) {
    return h('span', { class: 'jr-type t-' + i.type, role: 'img', 'aria-label': TYPES[i.type][0], title: TYPES[i.type][0] }, TYPES[i.type][1]);
  }
  function avatar(name) {
    return name
      ? h('span', { class: 'jr-av', role: 'img', 'aria-label': 'Assigned to ' + name, title: name }, initials(name))
      : h('span', { class: 'jr-av none', role: 'img', 'aria-label': 'Unassigned', title: 'Unassigned' }, '–');
  }
  const chip = (t, c) => h('span', { class: 'jr-chip' + (c ? ' ' + c : '') }, t);
  const progress = (p, label) => h('div', { class: 'jr-prog', role: 'img', 'aria-label': label }, h('i', { style: 'width:' + p + '%' }));
  function pass(i) {
    if (F.type && i.type !== F.type) return false;
    if (F.who === '__none') { if (i.assignee) return false; }
    else if (F.who && i.assignee !== F.who) return false;
    if (F.epic && epicOf(i) !== F.epic && i.id !== F.epic) return false;
    const q = F.q.trim().toLowerCase();
    if (q && (i.id + ' ' + i.title + ' ' + i.labels.join(' ')).toLowerCase().indexOf(q) === -1) return false;
    return true;
  }

  /* ---------- Board ---------- */
  let dragId = null;
  function card(i) {
    const epic = epicOf(i) ? byId(epicOf(i)) : null;
    const subs = i.type === 'subtask' ? [] : kids(i.id).filter((k) => k.type === 'subtask');
    const blk = blockers(i);
    const sel = h('select', { class: 'status jr-mv', 'aria-label': 'Move ' + i.id + ' to another column', 'data-f': 'mv-' + i.id });
    opts(sel, [i.status].concat(FLOW[i.status]).map((s) => [s, STATUS[s]]), i.status);
    sel.addEventListener('change', () => { move(i, sel.value); render(); });
    const el = h('article', { class: 'jr-card', draggable: 'true' },
      h('div', { class: 'jr-top' }, h('span', { class: 'jr-id' }, typeBadge(i), h('span', { class: 'jr-key' }, i.id)), h('span', { class: 'badge ' + PB[i.priority] }, PRI[i.priority])),
      h('button', { type: 'button', class: 'jr-link jr-title', 'data-f': 'o-' + i.id, onclick: () => openIssue(i.id) }, i.title),
      h('div', { class: 'jr-chips' },
        epic ? chip('Epic: ' + epic.title.slice(0, 22)) : null,
        i.type === 'subtask' ? chip('Sub-task of ' + i.parent) : null,
        subs.length ? chip(subs.filter((k) => k.status === 'done').length + ' of ' + subs.length + ' sub-tasks done') : null,
        blk.length ? chip('Blocked by ' + blk[0].id, 'bad') : null,
        pts(i) ? chip(pts(i) + ' pts') : null,
        i.labels.map((l) => chip(l))),
      h('div', { class: 'jr-top' }, sel, avatar(i.assignee)));
    el.addEventListener('dragstart', (e) => {
      dragId = i.id;
      e.dataTransfer.setData('text/plain', i.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('drag');
    });
    el.addEventListener('dragend', () => { dragId = null; el.classList.remove('drag'); });
    return el;
  }
  function column(c, a) {
    const list = db.issues.filter((i) => i.type !== 'epic' && sprintOf(i) === a.id && i.status === c && pass(i));
    const points = list.reduce((s, i) => s + pts(i), 0);
    const col = h('section', { class: 'jr-col', 'aria-label': STATUS[c] },
      h('div', { class: 'jr-colh' }, h('span', {}, STATUS[c]), chip(list.length + (points ? ' · ' + points + ' pts' : ''))),
      list.length ? list.map(card) : h('p', { class: 'sub jr-empty' }, 'No issues'));
    col.addEventListener('dragover', (e) => {
      const i = byId(dragId);
      if (i && FLOW[i.status].indexOf(c) !== -1) { e.preventDefault(); col.classList.add('ok'); }
    });
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('ok'); });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('ok');
      const i = byId(dragId);
      dragId = null;
      if (i) { move(i, c); render(); }
    });
    return col;
  }
  function renderBoard() {
    const root = $('jr-board'), a = active();
    if (!a) {
      put(root, h('div', { class: 'jr-banner' },
        h('strong', {}, 'No active sprint'),
        h('span', { class: 'sub' }, 'Plan a sprint in the Backlog, add issues to it, then start it to see the board.'),
        h('div', { class: 'tool-actions' }, h('button', { type: 'button', class: 'btn btn-primary sm', onclick: () => setTab('backlog') }, 'Go to Backlog'))));
      return;
    }
    const st = sstats(a.id), dl = daysLeft(a);
    const pct = st.total ? Math.round(st.done * 100 / st.total) : (st.n ? Math.round(st.nd * 100 / st.n) : 0);
    const when = [a.start || a.end ? fmt(a.start) + ' to ' + fmt(a.end) : '', dl === null ? '' : (dl < 0 ? plural(-dl, 'day') + ' overdue' : plural(dl, 'day') + ' left')].filter(Boolean).join(' · ');
    put(root,
      h('div', { class: 'jr-banner' },
        h('div', { class: 'jr-top' }, h('strong', {}, a.name), h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => completeSprint(a) }, 'Complete sprint')),
        a.goal ? h('span', { class: 'sub' }, 'Goal: ' + a.goal) : null,
        h('span', { class: 'sub' }, [when, st.done + ' of ' + st.total + ' points done'].filter(Boolean).join(' · ')),
        progress(pct, pct + '% of the sprint is done')),
      h('div', { class: 'jr-board' }, COLS.map((c) => column(c, a))));
  }

  /* ---------- Backlog ---------- */
  function sprintSelect(i) {
    const sel = h('select', { class: 'status', 'aria-label': 'Sprint for ' + i.id, 'data-f': 'sp-' + i.id });
    opts(sel, [['', 'Backlog']].concat(db.sprints.filter((s) => s.state !== 'closed').map((s) => [s.id, s.name])), i.sprint || '');
    sel.addEventListener('change', () => {
      const to = sel.value || null;
      log(i, 'Sprint: ' + (i.sprint ? sprintById(i.sprint).name : 'Backlog') + ' to ' + (to ? sprintById(to).name : 'Backlog'));
      i.sprint = to; save(); render();
    });
    return sel;
  }
  function row(i, control) {
    const subs = kids(i.id).filter((k) => k.type === 'subtask');
    return h('li', { class: 'jr-row' },
      h('span', { class: 'jr-id' }, typeBadge(i), h('span', { class: 'jr-key' }, i.id)),
      h('div', {},
        h('button', { type: 'button', class: 'jr-link jr-title', 'data-f': 'o-' + i.id, onclick: () => openIssue(i.id) }, i.title),
        h('div', { class: 'jr-chips' },
          i.type === 'subtask' ? chip('Sub-task of ' + i.parent) : null,
          subs.length ? chip(subs.filter((k) => k.status === 'done').length + ' of ' + subs.length + ' sub-tasks done') : null,
          blockers(i).length ? chip('Blocked', 'bad') : null,
          i.labels.map((l) => chip(l)))),
      h('span', { class: 'badge ' + PB[i.priority] }, PRI[i.priority]),
      pts(i) ? chip(pts(i) + ' pts') : h('span', {}),
      avatar(i.assignee),
      control);
  }
  function sprintSection(s) {
    const st = sstats(s.id), act = s.state === 'active';
    const list = db.issues.filter((i) => i.type !== 'epic' && i.type !== 'subtask' && i.sprint === s.id);
    const dates = s.start || s.end ? fmt(s.start) + ' to ' + fmt(s.end) : 'No dates yet';
    return h('section', { class: 'jr-sec' },
      h('div', { class: 'jr-sech' },
        h('div', {}, h('strong', {}, s.name + ' '), h('span', { class: 'badge ' + (act ? 'sev-critical' : 'sev-low') }, act ? 'Active' : 'Planned'),
          h('div', { class: 'sub' }, [dates, plural(st.n, 'issue'), st.total + ' points', s.goal ? 'Goal: ' + s.goal : ''].filter(Boolean).join(' · '))),
        h('div', { class: 'tool-actions' },
          act ? h('button', { type: 'button', class: 'btn btn-primary sm', onclick: () => completeSprint(s) }, 'Complete sprint')
              : h('button', { type: 'button', class: 'btn btn-primary sm', onclick: () => startSprint(s) }, 'Start sprint'),
          h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Edit ' + s.name, onclick: () => openSprint(s) }, 'Edit'),
          !act ? h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Delete ' + s.name, onclick: () => deleteSprint(s) }, 'Delete') : null)),
      list.length ? h('ul', { class: 'jr-list' }, list.map((i) => row(i, sprintSelect(i)))) : h('p', { class: 'sub jr-empty' }, 'No issues in this sprint yet. Move issues here from the backlog below.'));
  }
  function renderBacklog() {
    const live = db.sprints.filter((s) => s.state !== 'closed').sort((a, b) => (b.state === 'active') - (a.state === 'active') || nat(a.id, b.id));
    const bl = db.issues.filter((i) => i.type !== 'epic' && i.type !== 'subtask' && !i.sprint && i.status !== 'done');
    const form = h('form', { class: 'jr-quick', novalidate: true });
    const qt = h('select', { class: 'input', 'aria-label': 'Type of new issue' });
    opts(qt, WORK.map((t) => [t, TYPES[t][0]]), 'story');
    const qi = h('input', { class: 'input', 'aria-label': 'Title of new issue', placeholder: 'What needs to be done?', maxlength: '140', 'data-f': 'qc' });
    form.append(qt, qi, h('button', { type: 'submit', class: 'btn btn-primary sm' }, 'Create'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = qi.value.trim();
      if (!t) { qi.focus(); return; }
      addIssue({ type: qt.value, title: t });
      render();
    });
    const closed = db.sprints.filter((s) => s.state === 'closed');
    const vel = closed.length ? Math.round(closed.reduce((a, s) => a + (s.report ? s.report.done : 0), 0) / closed.length) : 0;
    put($('jr-backlog'), 
      h('div', { class: 'tool-actions' }, h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => openSprint(null) }, 'Create sprint')),
      live.map(sprintSection),
      h('section', { class: 'jr-sec' },
        h('div', { class: 'jr-sech' }, h('div', {}, h('strong', {}, 'Backlog'), h('div', { class: 'sub' }, plural(bl.length, 'issue') + ' · ' + bl.reduce((a, i) => a + pts(i), 0) + ' points'))),
        bl.length ? h('ul', { class: 'jr-list' }, bl.map((i) => row(i, sprintSelect(i)))) : h('p', { class: 'sub jr-empty' }, 'The backlog is empty. Add an issue below.'),
        form),
      closed.length ? h('details', { class: 'jr-sec' },
        h('summary', {}, 'Completed sprints (' + closed.length + ') · average velocity ' + vel + ' points'),
        h('ul', { class: 'jr-list' }, closed.slice().reverse().map((s) => h('li', { class: 'jr-sech' },
          h('div', {}, h('strong', {}, s.name), h('div', { class: 'sub' }, fmt(s.start) + ' to ' + fmt(s.end) + (s.report ? ' · ' + s.report.done + ' of ' + s.report.committed + ' points done · ' + s.report.nd + ' of ' + s.report.n + ' issues done' : '')))))))
        : null);
  }

  /* ---------- All issues and epics ---------- */
  function renderIssues() {
    const ord = Object.keys(PRI);
    const cmp = {
      updated: (a, b) => b.updated.localeCompare(a.updated),
      priority: (a, b) => ord.indexOf(a.priority) - ord.indexOf(b.priority) || nat(a.id, b.id),
      key: (a, b) => nat(a.id, b.id)
    }[F.sort];
    const all = db.issues.filter(pass).sort(cmp);
    const shown = all.slice(0, 300);
    put($('jr-issues'), 
      h('div', { class: 'tool-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: importBugs }, 'Import my bug reports'),
        h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: exportCsv }, 'Download CSV'),
        h('span', { class: 'sub' }, plural(all.length, 'issue') + (all.length > shown.length ? ' (showing the first 300)' : ''))),
      shown.length ? h('section', { class: 'jr-sec' }, h('ul', { class: 'jr-list' }, shown.map((i) => {
        let end;
        if (i.type === 'epic') { const c = db.issues.filter((x) => x.parent === i.id); end = h('span', { class: 'jr-chip' }, c.filter((x) => x.status === 'done').length + ' of ' + c.length + ' done'); }
        else end = h('span', { class: 'badge ' + (i.status === 'done' ? 'sev-low' : 'sev-medium') }, STATUS[i.status]);
        return row(i, end);
      }))) : h('p', { class: 'sub' }, 'No issues match your filters.'));
  }
  function renderEpics() {
    const eps = db.issues.filter((i) => i.type === 'epic');
    put($('jr-epics'), 
      h('div', { class: 'tool-actions' }, h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => openNew('epic') }, 'Create epic')),
      eps.length ? eps.map((e) => {
        const ch = db.issues.filter((i) => i.parent === e.id);
        const total = ch.reduce((a, i) => a + pts(i), 0), done = ch.filter((i) => i.status === 'done').reduce((a, i) => a + pts(i), 0);
        const nd = ch.filter((i) => i.status === 'done').length;
        const pct = total ? Math.round(done * 100 / total) : (ch.length ? Math.round(nd * 100 / ch.length) : 0);
        return h('section', { class: 'jr-sec jr-epic' },
          h('div', { class: 'jr-top' },
            h('span', { class: 'jr-id' }, typeBadge(e), h('span', { class: 'jr-key' }, e.id), h('button', { type: 'button', class: 'jr-link jr-title', 'data-f': 'o-' + e.id, onclick: () => openIssue(e.id) }, e.title)),
            h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Show ' + e.id + ' issues on the board', onclick: () => { F.epic = e.id; drawFilters(); setTab('board'); } }, 'Show on board')),
          progress(pct, pct + '% of ' + e.id + ' is done'),
          h('span', { class: 'sub' }, plural(ch.length, 'issue') + ' · ' + nd + ' done · ' + done + ' of ' + total + ' points'));
      }) : h('p', { class: 'sub' }, 'No epics yet. An epic groups related stories, tasks and bugs.'));
  }

  /* ---------- Creating, importing, exporting ---------- */
  function addIssue(o) {
    db.n++;
    const now = new Date().toISOString();
    const i = Object.assign({ id: db.key + '-' + db.n, type: 'task', title: '', desc: '', status: 'todo', priority: 'medium', assignee: '', reporter: author(), points: 0, labels: [], parent: null, sprint: null, links: [], comments: [], log: [], created: now, updated: now, src: null }, o);
    i.log.push({ at: now, by: author(), text: 'Created' });
    db.issues.push(i);
    save();
    return i;
  }
  function importBugs() {
    if (!window.BBuddy) return toast('Your bug reports aren’t available here.');
    const have = new Set(db.issues.map((i) => i.src).filter(Boolean));
    const list = window.BBuddy.getReports().filter((r) => !have.has(r.id));
    if (!list.length) return toast('All your bug reports are already imported.');
    list.forEach((r) => {
      const i = addIssue({ type: 'bug', title: String(r.title).slice(0, 140), desc: String(r.desc || '').slice(0, 3000), priority: SEV2PRI[r.severity] || 'medium', status: REP2ST[r.status] || 'todo', assignee: r.assignee || '', src: r.id });
      if (r.created) i.created = r.created;
      i.log[0].text = 'Imported from your bug reports';
    });
    save(); render(); drawFilters();
    toast('Imported ' + plural(list.length, 'bug report') + '.');
  }
  function exportCsv() {
    if (!db.issues.length) return toast('No issues to export.');
    const cols = ['key', 'type', 'title', 'status', 'priority', 'assignee', 'points', 'sprint', 'epic', 'labels', 'created'];
    const rows = db.issues.map((i) => {
      const s = sprintOf(i), e = epicOf(i);
      return [i.id, TYPES[i.type][0], i.title, STATUS[i.status], PRI[i.priority], i.assignee, pts(i), s ? sprintById(s).name : '', e || '', i.labels.join(' '), i.created];
    });
    download(db.key.toLowerCase() + '-issues.csv', [cols.join(',')].concat(rows.map((r) => r.map(csvCell).join(','))).join('\r\n'), 'text/csv');
  }

  /* ---------- Sprints ---------- */
  let editSprint = null;
  function openSprint(s) {
    editSprint = s;
    $('jr-sph').textContent = s ? 'Edit ' + s.name : 'Create sprint';
    $('jr-spn').value = s ? s.name : 'Sprint ' + (db.sn + 1);
    $('jr-spg').value = s ? s.goal : '';
    $('jr-sps').value = s ? s.start : '';
    $('jr-spe').value = s ? s.end : '';
    $('jr-sperr').textContent = '';
    $('jr-sp').showModal();
    $('jr-spn').focus();
  }
  $('jr-spx').addEventListener('click', () => $('jr-sp').close());
  $('jr-spf').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('jr-spn').value.trim(), st = $('jr-sps').value, en = $('jr-spe').value;
    if (!name) { $('jr-sperr').textContent = 'Enter a sprint name.'; return; }
    if (st && en && en < st) { $('jr-sperr').textContent = 'The end date must be after the start date.'; return; }
    if (editSprint) Object.assign(editSprint, { name, goal: $('jr-spg').value.trim(), start: st, end: en });
    else { db.sn++; db.sprints.push({ id: 'sp' + db.sn, name, goal: $('jr-spg').value.trim(), state: 'planned', start: st, end: en }); }
    save(); $('jr-sp').close(); render();
  });
  function startSprint(s) {
    if (active()) return toast('Complete ' + active().name + ' before you start another sprint.');
    const st = sstats(s.id);
    if (!st.n && !confirm(s.name + ' has no issues. Start it anyway?')) return;
    if (!s.start) s.start = today();
    if (!s.end) s.end = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    s.state = 'active';
    s.committed = st.total;
    save(); setTab('board');
    toast(s.name + ' started.');
  }
  function deleteSprint(s) {
    const n = db.issues.filter((i) => i.sprint === s.id).length;
    if (!confirm('Delete ' + s.name + (n ? '? Its ' + plural(n, 'issue') + ' will go back to the backlog.' : '?'))) return;
    db.issues.forEach((i) => { if (i.sprint === s.id) i.sprint = null; });
    db.sprints = db.sprints.filter((x) => x !== s);
    save(); render();
  }
  let finishing = null;
  function completeSprint(s) {
    finishing = s;
    const st = sstats(s.id), left = st.n - st.nd;
    $('jr-sdt').textContent = s.name + ': ' + st.nd + ' of ' + plural(st.n, 'issue') + ' done, ' + st.done + ' of ' + st.total + ' points. ' +
      (left ? plural(left, 'issue') + ' not finished.' : 'Everything is finished.');
    opts($('jr-sdto'), [['', 'Backlog']].concat(db.sprints.filter((x) => x.state === 'planned').map((x) => [x.id, x.name])), db.sprints.find((x) => x.state === 'planned') ? db.sprints.find((x) => x.state === 'planned').id : '');
    $('jr-sdto').disabled = !left;
    $('jr-sd').showModal();
  }
  $('jr-sdx').addEventListener('click', () => $('jr-sd').close());
  $('jr-sdf').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = finishing;
    if (!s) return;
    const st = sstats(s.id), to = $('jr-sdto').value || null;
    st.l.filter((i) => i.status !== 'done').forEach((i) => { log(i, 'Sprint: ' + s.name + ' to ' + (to ? sprintById(to).name : 'Backlog')); i.sprint = to; });
    s.report = { committed: s.committed != null ? s.committed : st.total, done: st.done, n: st.n, nd: st.nd };
    s.state = 'closed';
    s.end = s.end || today();
    save(); $('jr-sd').close(); render();
    toast(s.name + ' completed.');
  });

  /* ---------- Issue dialog ---------- */
  let cur = null, isNew = false;
  opts($('jr-type'), Object.keys(TYPES).map((t) => [t, TYPES[t][0]]));
  opts($('jr-pri'), Object.keys(PRI).map((p) => [p, PRI[p]]));

  function blank(type) {
    return { id: '', type, title: '', desc: '', status: 'todo', priority: 'medium', assignee: '', points: 0, labels: [], parent: null, sprint: null, links: [], comments: [], log: [] };
  }
  function openNew(type) { openDlg(blank(type || 'task'), true); }
  function openIssue(id) {
    const i = byId(id);
    if (i) openDlg(i, false);
  }
  function syncType() {
    const t = $('jr-type').value, sel = $('jr-parent'), keep = sel.value;
    const flat = t === 'epic' || t === 'subtask';
    $('jr-pts-row').hidden = flat;
    $('jr-sprint-row').hidden = flat;
    $('jr-status-row').hidden = t === 'epic' || isNew;
    $('jr-parent-row').hidden = t === 'epic';
    if (t === 'subtask') {
      $('jr-parent-label').textContent = 'Parent issue';
      opts(sel, db.issues.filter((x) => WORK.indexOf(x.type) !== -1 && x.id !== cur.id).map((x) => [x.id, x.id + ' ' + x.title]), keep);
    } else {
      $('jr-parent-label').textContent = 'Epic';
      opts(sel, [['', 'No epic']].concat(db.issues.filter((x) => x.type === 'epic' && x.id !== cur.id).map((x) => [x.id, x.id + ' ' + x.title])), keep);
    }
  }
  $('jr-type').addEventListener('change', syncType);

  function openDlg(i, fresh) {
    cur = i; isNew = fresh;
    $('jr-dh').textContent = fresh ? 'Create issue' : i.id;
    $('jr-type').value = i.type;
    $('jr-title').value = i.title;
    $('jr-desc').value = i.desc || '';
    $('jr-pri').value = i.priority;
    $('jr-who').value = i.assignee || '';
    $('jr-pts').value = i.points || '';
    $('jr-labels').value = i.labels.join(', ');
    opts($('jr-status'), [i.status].concat(FLOW[i.status]).map((s) => [s, STATUS[s]]), i.status);
    opts($('jr-sprint'), [['', 'Backlog']].concat(db.sprints.filter((s) => s.state !== 'closed' || s.id === i.sprint).map((s) => [s.id, s.name])), i.sprint || '');
    $('jr-names').replaceChildren(...Array.from(new Set(db.issues.map((x) => x.assignee).filter(Boolean).concat([author()]))).map((n) => h('option', { value: n })));
    $('jr-parent').replaceChildren();
    syncType();
    if (i.parent) $('jr-parent').value = i.parent;
    $('jr-extra').hidden = fresh;
    $('jr-del').hidden = fresh;
    $('jr-meta').textContent = fresh ? '' : 'Reported by ' + (i.reporter || 'unknown') + ' · Created ' + stamp(i.created) + ' · Updated ' + stamp(i.updated);
    $('jr-derr').textContent = '';
    if (!fresh) drawExtra();
    if (!dlg.open) dlg.showModal();
    $('jr-title').focus();
  }
  $('jr-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function parseLabels(s) {
    const seen = new Set();
    return s.split(',').map((x) => x.trim().toLowerCase().replace(/[^\w\- ]/g, '').slice(0, 24)).filter((x) => x && !seen.has(x) && seen.add(x)).slice(0, 8);
  }
  function nameOf(kind, v) {
    if (kind === 'sprint') return v ? (sprintById(v) || { name: v }).name : 'Backlog';
    if (kind === 'parent') return v || 'none';
    if (kind === 'priority') return PRI[v];
    if (kind === 'type') return TYPES[v][0];
    return v === '' || v == null ? 'none' : String(v);
  }
  $('jr-save').addEventListener('click', () => {
    const err = (m) => { $('jr-derr').textContent = m; };
    const title = $('jr-title').value.trim(), t = $('jr-type').value;
    if (!title) { err('Enter a title.'); $('jr-title').focus(); return; }
    const parent = t === 'epic' ? null : ($('jr-parent').value || null);
    if (t === 'subtask' && !parent) return err('Choose the parent issue for this sub-task.');
    if (!isNew && t !== cur.type && kids(cur.id).length) return err('Move or delete the child issues of ' + cur.id + ' before you change its type.');
    const status = isNew || t === 'epic' ? 'todo' : $('jr-status').value;
    if (!isNew && status !== cur.status) { const bad = checkMove(cur, status); if (bad) return err(bad); }
    const flat = t === 'epic' || t === 'subtask';
    const next = {
      type: t, title, desc: $('jr-desc').value.trim(), priority: $('jr-pri').value, assignee: $('jr-who').value.trim(),
      points: flat ? 0 : Math.max(0, Math.min(100, parseInt($('jr-pts').value, 10) || 0)),
      labels: parseLabels($('jr-labels').value), parent, sprint: flat ? null : ($('jr-sprint').value || null)
    };
    if (isNew) {
      const i = addIssue(Object.assign(next, { status: 'todo' }));
      dlg.close(); render(); drawFilters();
      toast('Created ' + i.id);
      return;
    }
    ['type', 'priority', 'assignee', 'points', 'sprint', 'parent'].forEach((k) => {
      if (String(cur[k] == null ? '' : cur[k]) !== String(next[k] == null ? '' : next[k])) log(cur, k[0].toUpperCase() + k.slice(1) + ': ' + nameOf(k, cur[k]) + ' to ' + nameOf(k, next[k]));
    });
    if (cur.title !== next.title) log(cur, 'Title changed');
    Object.assign(cur, next);
    if (status !== cur.status) { log(cur, 'Status: ' + STATUS[cur.status] + ' to ' + STATUS[status]); cur.status = status; }
    cur.updated = new Date().toISOString();
    save(); dlg.close(); render(); drawFilters();
    toast('Saved ' + cur.id);
  });
  $('jr-del').addEventListener('click', () => {
    const i = cur;
    if (!i || isNew) return;
    const subs = kids(i.id).filter((k) => k.type === 'subtask');
    if (!confirm('Delete ' + i.id + (subs.length ? ' and its ' + plural(subs.length, 'sub-task') : '') + '? This can’t be undone.')) return;
    const gone = new Set([i.id].concat(subs.map((k) => k.id)));
    db.issues = db.issues.filter((x) => !gone.has(x.id));
    db.issues.forEach((x) => { if (x.parent === i.id) x.parent = null; x.links = x.links.filter((l) => !gone.has(l.to)); });
    save(); dlg.close(); render(); drawFilters();
    toast('Deleted ' + i.id);
  });

  /* Sub-tasks, links, comments and history inside the dialog */
  function allLinks(i) {
    const out = i.links.map((l, n) => ({ label: OUT[l.type], other: byId(l.to), remove: () => { i.links.splice(n, 1); } }));
    db.issues.forEach((x) => {
      if (x === i) return;
      x.links.forEach((l, n) => { if (l.to === i.id) out.push({ label: IN[l.type], other: x, remove: () => { x.links.splice(n, 1); } }); });
    });
    return out.filter((l) => l.other);
  }
  function drawExtra() {
    const i = cur, parts = [];
    if (WORK.indexOf(i.type) !== -1) {
      const subs = kids(i.id).filter((k) => k.type === 'subtask');
      const inp = h('input', { class: 'input', 'aria-label': 'New sub-task title', placeholder: 'Add a sub-task', maxlength: '140' });
      const add = () => {
        const t = inp.value.trim();
        if (!t) return;
        addIssue({ type: 'subtask', title: t, parent: i.id, priority: i.priority });
        log(i, 'Sub-task added'); save(); drawExtra(); render();
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      parts.push(h('section', {}, h('h3', { class: 'jr-h' }, 'Sub-tasks' + (subs.length ? ' (' + subs.filter((k) => k.status === 'done').length + ' of ' + subs.length + ' done)' : '')),
        subs.length ? h('ul', { class: 'jr-mini' }, subs.map((k) => {
          const sel = h('select', { class: 'status', 'aria-label': 'Status of ' + k.id });
          opts(sel, [k.status].concat(FLOW[k.status]).map((s) => [s, STATUS[s]]), k.status);
          sel.addEventListener('change', () => { move(k, sel.value); drawExtra(); render(); });
          return h('li', {}, h('button', { type: 'button', class: 'jr-link', onclick: () => openIssue(k.id) }, k.id + ' ' + k.title), sel);
        })) : null,
        h('div', { class: 'jr-quick', style: 'padding:8px 0 0' }, inp, h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: add }, 'Add'))));
    }
    const linkKind = h('select', { class: 'input', 'aria-label': 'Link type' });
    opts(linkKind, [['blocks', 'blocks'], ['blockedby', 'is blocked by'], ['duplicates', 'duplicates'], ['relates', 'relates to']]);
    const linkTo = h('select', { class: 'input', 'aria-label': 'Issue to link' });
    opts(linkTo, db.issues.filter((x) => x.id !== i.id).map((x) => [x.id, x.id + ' ' + x.title.slice(0, 40)]));
    const links = allLinks(i);
    parts.push(h('section', {}, h('h3', { class: 'jr-h' }, 'Linked issues'),
      links.length ? h('ul', { class: 'jr-mini' }, links.map((l) => h('li', {},
        h('span', {}, l.label + ' '), h('button', { type: 'button', class: 'jr-link', onclick: () => openIssue(l.other.id) }, l.other.id + ' ' + l.other.title),
        h('button', { type: 'button', class: 'btn btn-ghost sm', 'aria-label': 'Remove link to ' + l.other.id, onclick: () => { l.remove(); save(); drawExtra(); render(); } }, 'Remove')))) : h('p', { class: 'sub' }, 'No links yet.'),
      h('div', { class: 'jr-quick', style: 'padding:8px 0 0' }, linkKind, linkTo, h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => {
        const other = byId(linkTo.value);
        if (!other) return;
        const k = linkKind.value, dup = allLinks(i).some((l) => l.other === other && (l.label === (k === 'blockedby' ? 'is blocked by' : OUT[k])));
        if (dup) return toast('That link already exists.');
        if (k === 'blockedby') other.links.push({ type: 'blocks', to: i.id }); else i.links.push({ type: k, to: other.id });
        log(i, 'Linked to ' + other.id); save(); drawExtra(); render();
      } }, 'Add link'))));
    const cm = h('textarea', { class: 'input', rows: '2', maxlength: '1000', 'aria-label': 'Add a comment', placeholder: 'Add a comment' });
    parts.push(h('section', {}, h('h3', { class: 'jr-h' }, 'Comments (' + i.comments.length + ')'),
      i.comments.length ? h('ul', { class: 'jr-mini' }, i.comments.slice().reverse().map((c) => h('li', { class: 'jr-cm' }, h('span', { class: 'sub' }, c.by + ' · ' + stamp(c.at)), h('p', {}, c.text)))) : null,
      cm, h('div', { class: 'tool-actions', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn btn-ghost sm', onclick: () => {
        const t = cm.value.trim();
        if (!t) return;
        i.comments.push({ by: author(), at: new Date().toISOString(), text: t });
        if (i.comments.length > 100) i.comments.shift();
        i.updated = new Date().toISOString();
        save(); drawExtra();
      } }, 'Post comment'))));
    parts.push(h('details', {}, h('summary', { class: 'jr-h' }, 'Activity (' + i.log.length + ')'),
      h('ul', { class: 'jr-mini' }, i.log.slice().reverse().map((l) => h('li', {}, h('span', { class: 'sub' }, stamp(l.at) + ' · ' + l.by + ': ' + l.text))))));
    $('jr-extra').replaceChildren(...parts);
  }

  /* ---------- Project settings ---------- */
  $('jr-pj-btn').addEventListener('click', () => {
    $('jr-pjn').value = db.name;
    $('jr-pjk').value = db.key;
    $('jr-pjk').disabled = db.issues.length > 0;
    $('jr-pjkh').textContent = db.issues.length ? 'The key can’t change once the project has issues.' : 'Two to five capital letters, like BBD.';
    $('jr-pjerr').textContent = '';
    $('jr-pj').showModal();
  });
  $('jr-pjx').addEventListener('click', () => $('jr-pj').close());
  $('jr-pjf').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('jr-pjn').value.trim(), key = $('jr-pjk').value.trim().toUpperCase();
    if (!name) { $('jr-pjerr').textContent = 'Enter a project name.'; return; }
    if (!db.issues.length && !/^[A-Z][A-Z0-9]{1,4}$/.test(key)) { $('jr-pjerr').textContent = 'The key needs 2 to 5 capital letters or numbers, starting with a letter.'; return; }
    db.name = name;
    if (!db.issues.length) db.key = key;
    save(); $('jr-pj').close(); drawHeader();
  });
  $('jr-pjclear').addEventListener('click', () => {
    if (!confirm('Delete every issue and sprint in this project? This can’t be undone.')) return;
    db.issues = []; db.sprints = []; db.n = 0; db.sn = 0;
    save(); $('jr-pj').close(); render(); drawFilters();
  });

  /* ---------- Filters, header and stats ---------- */
  function drawFilters() {
    const names = Array.from(new Set(db.issues.map((i) => i.assignee).filter(Boolean))).sort();
    opts($('jr-fwho'), [['', 'Everyone'], ['__none', 'Unassigned']].concat(names.map((n) => [n, n])), F.who);
    opts($('jr-fepic'), [['', 'All epics']].concat(db.issues.filter((i) => i.type === 'epic').map((e) => [e.id, e.id + ' ' + e.title])), F.epic);
    opts($('jr-ftype'), [['', 'All types']].concat(Object.keys(TYPES).map((t) => [t, TYPES[t][0]])), F.type);
    F.who = $('jr-fwho').value; F.epic = $('jr-fepic').value; F.type = $('jr-ftype').value;
  }
  $('jr-fq').addEventListener('input', () => { F.q = $('jr-fq').value; render(); });
  [['jr-fwho', 'who'], ['jr-ftype', 'type'], ['jr-fepic', 'epic'], ['jr-fsort', 'sort']].forEach(([id, k]) => {
    $(id).addEventListener('change', () => { F[k] = $(id).value; render(); });
  });
  function drawHeader() { $('jr-sub').textContent = db.name + ' · project key ' + db.key; }
  function drawStats() {
    const work = db.issues.filter((i) => i.type !== 'epic'), open = work.filter((i) => i.status !== 'done');
    const a = active(), s = a ? sstats(a.id) : null;
    const stat = (n, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-num' }, n), h('div', { class: 'stat-label' }, l));
    $('jr-stats').replaceChildren(
      stat(open.length, 'Open issues'),
      stat(open.filter((i) => i.type === 'bug').length, 'Open bugs'),
      stat(s ? s.done + '/' + s.total : '–', 'Points done in sprint'),
      stat(open.filter((i) => !i.assignee && i.type !== 'subtask').length, 'Unassigned'));
  }

  /* ---------- Tabs and navigation ---------- */
  const panels = { board: $('jr-board'), backlog: $('jr-backlog'), issues: $('jr-issues'), epics: $('jr-epics') };
  function render() {
    const el = document.activeElement, f = el && el.getAttribute ? el.getAttribute('data-f') : null;
    ({ board: renderBoard, backlog: renderBacklog, issues: renderIssues, epics: renderEpics })[tab]();
    drawStats();
    if (f) { const n = view.querySelector('[data-f="' + f + '"]'); if (n) n.focus(); }
  }
  function setTab(t) {
    tab = t;
    Object.keys(panels).forEach((k) => { panels[k].hidden = k !== t; });
    document.querySelectorAll('[data-jt]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.jt === t)));
    $('jr-filters').hidden = !(t === 'board' || t === 'issues');
    $('jr-sortf').hidden = t !== 'issues';
    render();
  }
  document.querySelectorAll('[data-jt]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.jt)));
  $('jr-new').addEventListener('click', () => openNew('task'));

  const btn = $('jr-btn');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  const others = ['tools', 'test', 'au', 'hs', 'rl'];
  const otherViews = ['tools-view', 'test-view', 'auto-view', 'hist-view', 'rel-view'];
  function show(on) {
    if (on) {
      reportEls.forEach((el) => { el.style.display = 'none'; });
      otherViews.forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
      others.forEach((p) => { const b = $(p + '-btn'); if (b) b.setAttribute('aria-current', 'false'); });
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
      drawFilters();
      setTab(tab);
    }
    view.style.display = on ? '' : 'none';
    btn.setAttribute('aria-current', String(on));
  }
  btn.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => show(false)));
  others.forEach((p) => { const b = $(p + '-btn'); if (b) b.addEventListener('click', () => show(false)); });

  window.BJira = { getIssues: () => db.issues, getSprints: () => db.sprints };
  drawHeader();
  setTab('board');
})();