(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'bbuddy_ws';
  const MAX_BYTES = 4 * 1024 * 1024;
  const RUN_LIMIT = 10000;

  /* ---------- Languages ---------- */
  const LANGS = {
    js: { n: 'JavaScript', c: '//', kw: 'async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new null of return static super switch this throw true false try typeof undefined var void while yield' },
    java: { n: 'Java', c: '//', kw: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while var String' },
    py: { n: 'Python', c: '#', kw: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield' },
    json: { n: 'JSON', c: '', kw: 'true false null' },
    html: { n: 'HTML', c: '' }, css: { n: 'CSS', c: '' }, md: { n: 'Markdown', c: '' }, txt: { n: 'Text', c: '' }
  };
  const EXT = { js: 'js', mjs: 'js', cjs: 'js', ts: 'js', jsx: 'js', java: 'java', py: 'py', json: 'json', html: 'html', htm: 'html', css: 'css', md: 'md', txt: 'txt' };
  const MIME = { js: 'text/javascript', java: 'text/plain', py: 'text/plain', json: 'application/json', html: 'text/html', css: 'text/css', md: 'text/markdown', txt: 'text/plain' };
  const langOf = (p) => EXT[(p.split('.').pop() || '').toLowerCase()] || 'txt';

  /* ---------- Starter templates ---------- */
  const TEMPLATES = [
    ['Playwright test (JS)', 'tests/example.spec.js', "// Needs Node.js on your computer: copy this file into a Playwright project.\nconst { test, expect } = require('@playwright/test');\n\ntest('login page has a title', async ({ page }) => {\n  await page.goto('https://your-site.netlify.app/login.html');\n  await expect(page).toHaveTitle(/Bug Reporting Buddy/);\n});\n"],
    ['Selenium + JUnit (Java)', 'tests/LoginTest.java', 'import org.junit.jupiter.api.*;\nimport org.openqa.selenium.*;\nimport org.openqa.selenium.chrome.ChromeDriver;\n\npublic class LoginTest {\n  WebDriver driver;\n\n  @BeforeEach\n  void setUp() { driver = new ChromeDriver(); }\n\n  @Test\n  void pageHasTitle() {\n    driver.get("https://your-site.netlify.app/login.html");\n    Assertions.assertTrue(driver.getTitle().contains("Bug Reporting Buddy"));\n  }\n\n  @AfterEach\n  void tearDown() { driver.quit(); }\n}\n'],
    ['Pytest + Selenium (Python)', 'tests/test_login.py', 'import pytest\nfrom selenium import webdriver\n\n\n@pytest.fixture\ndef driver():\n    d = webdriver.Chrome()\n    yield d\n    d.quit()\n\n\ndef test_page_has_title(driver):\n    driver.get("https://your-site.netlify.app/login.html")\n    assert "Bug Reporting Buddy" in driver.title\n'],
    ['Cypress test (JS)', 'cypress/e2e/login.cy.js', "describe('Login page', () => {\n  it('shows the sign-in form', () => {\n    cy.visit('https://your-site.netlify.app/login.html');\n    cy.get('form').should('be.visible');\n  });\n});\n"],
    ['Test data (JSON)', 'data/test-data.json', '{\n  "validUser": { "email": "qa@example.com", "password": "Passw0rd!" },\n  "invalidEmails": ["", "plain", "a@b", "a b@c.com"]\n}\n'],
    ['Runnable demo (JS)', 'demo.js', "console.log('Hello from the workspace');\nconsole.log([1, 2, 3].map((n) => n * 2));\n"],
    ['Preview page (HTML)', 'index.html', '<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>Preview</title></head>\n<body>\n  <h1>Hello</h1>\n  <button id="b">Click me</button>\n  <script>document.getElementById("b").onclick = () => alert("Clicked");<\/script>\n</body>\n</html>\n']
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
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const nat = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const baseOf = (p) => p.split('/').pop();

  /* ---------- Data ---------- */
  function seed() {
    const files = Object.create(null);
    files['README.md'] = '# My test workspace\n\nWrite and keep your test scripts here. Everything is saved in this browser.\n\n- Open tests/login.test.js and press Run (Ctrl+Enter).\n- Use the Templates list to add Playwright, Selenium, Pytest or Cypress starters.\n- JavaScript runs here. Java and Python files are edit-only for now.\n';
    files['tests/login.test.js'] = "// A tiny test runner. Press Run (or Ctrl+Enter) to try it.\nfunction test(name, fn) {\n  try { fn(); console.log('PASS ' + name); }\n  catch (e) { console.error('FAIL ' + name + ': ' + e.message); }\n}\nfunction expect(actual) {\n  return {\n    toBe(x) {\n      if (actual !== x) throw new Error('expected ' + JSON.stringify(x) + ' but got ' + JSON.stringify(actual));\n    }\n  };\n}\n\nfunction isValidEmail(s) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s); }\n\ntest('accepts a normal email', () => expect(isValidEmail('qa@example.com')).toBe(true));\ntest('rejects an empty email', () => expect(isValidEmail('')).toBe(false));\ntest('rejects a missing dot', () => expect(isValidEmail('a@b')).toBe(false));\ntest('this one fails on purpose', () => expect(isValidEmail('a@b')).toBe(true));\n";
    files['data/test-data.json'] = TEMPLATES[4][2];
    return { v: 1, files, dirs: [], open: ['tests/login.test.js'], active: 'tests/login.test.js', sel: { path: 'tests/login.test.js', dir: false }, collapsed: [] };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const r = JSON.parse(raw);
        if (r && r.files && typeof r.files === 'object') {
          const files = Object.create(null);
          Object.keys(r.files).forEach((k) => { if (typeof r.files[k] === 'string' && k !== '__proto__') files[k] = r.files[k]; });
          const open = (Array.isArray(r.open) ? r.open : []).filter((p) => files[p] !== undefined);
          return {
            v: 1, files, dirs: Array.isArray(r.dirs) ? r.dirs.filter((d) => typeof d === 'string') : [], open,
            active: files[r.active] !== undefined ? r.active : (open[0] || null),
            sel: r.sel && typeof r.sel.path === 'string' ? { path: r.sel.path, dir: !!r.sel.dir } : null,
            collapsed: Array.isArray(r.collapsed) ? r.collapsed : []
          };
        }
      }
    } catch (e) { /* fall through to starter files */ }
    return seed();
  }
  let ws = load();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    try {
      const s = JSON.stringify(ws);
      if (s.length > MAX_BYTES) { setStatus('Too big to save'); return toast('The workspace is over 4 MB, so it can’t be saved. Delete large files.'); }
      localStorage.setItem(KEY, s);
      setStatus('All changes saved');
    } catch (e) { setStatus('Not saved'); toast('Browser storage is full or blocked, so changes can’t be saved.'); }
  }
  function saveSoon() { setStatus('Saving…'); clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
  try { if (!localStorage.getItem(KEY)) save(); } catch (e) { /* ignore */ }

  /* ---------- Paths ---------- */
  function cleanPath(p) {
    const segs = String(p).replace(/\\/g, '/').split('/').map((s) => s.trim());
    if (!segs.length || segs.some((s) => !s || s === '.' || s === '..' || s === '__proto__' || s.length > 80 || /[:*?"<>|\x00-\x1f]/.test(s))) return null;
    return segs.join('/');
  }
  function allDirs() {
    const set = new Set(ws.dirs);
    Object.keys(ws.files).forEach((p) => { for (let d = dirOf(p); d; d = dirOf(d)) set.add(d); });
    return set;
  }
  const taken = (p) => ws.files[p] !== undefined || allDirs().has(p);
  function blockedByFile(p) { for (let d = dirOf(p); d; d = dirOf(d)) if (ws.files[d] !== undefined) return true; return false; }
  function baseDir() { const s = ws.sel; if (!s) return ''; return s.dir ? s.path : dirOf(s.path); }
  function freeName(dir, name) {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    let n = 0, p;
    do { p = (dir ? dir + '/' : '') + stem + (n ? '-' + n : '') + ext; n++; } while (taken(p));
    return p;
  }

  /* ---------- Page shell ---------- */
  navList.insertAdjacentHTML('beforeend', '<button class="nav" id="ws-btn">Code workspace</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="ws-view" style="display:none">
    <header class="top">
      <div><h1>Code workspace</h1><p class="sub">Write and keep your test scripts. JavaScript runs right here; Java and Python are edit-only.</p></div>
      <div class="tool-actions">
        <select id="ws-tpl" class="input ws-tpl" aria-label="Add a file from a template"></select>
      </div>
    </header>
    <div class="ws-bar" role="toolbar" aria-label="Editor actions">
      <button type="button" class="btn btn-primary sm" id="ws-run">Run</button>
      <button type="button" class="btn btn-ghost sm" id="ws-prevbtn">Preview</button>
      <button type="button" class="btn btn-ghost sm" id="ws-fmt">Format JSON</button>
      <button type="button" class="btn btn-ghost sm" id="ws-findbtn">Find</button>
      <button type="button" class="btn btn-ghost sm" id="ws-dl">Download file</button>
    </div>
    <div class="ws-grid">
      <aside class="ws-side" aria-label="Files">
        <div class="ws-sidebar-h">
          <strong>Files</strong>
          <span class="ws-acts">
            <button type="button" class="btn btn-ghost sm" id="ws-nf" aria-label="New file">+ File</button>
            <button type="button" class="btn btn-ghost sm" id="ws-nd-btn" aria-label="New folder">+ Folder</button>
          </span>
        </div>
        <div class="ws-tree" id="ws-tree"></div>
        <div class="ws-acts ws-sel">
          <button type="button" class="btn btn-ghost sm" id="ws-rn">Rename</button>
          <button type="button" class="btn btn-ghost sm" id="ws-del">Delete</button>
        </div>
      </aside>
      <div class="ws-main">
        <div class="ws-tabs" id="ws-tabs" role="tablist" aria-label="Open files"></div>
        <div class="ws-find" id="ws-find" hidden>
          <input class="input" id="ws-fi" placeholder="Find" aria-label="Find">
          <input class="input" id="ws-ri" placeholder="Replace with" aria-label="Replace with">
          <span class="sub" id="ws-fc" aria-live="polite"></span>
          <button type="button" class="btn btn-ghost sm" id="ws-fp">Prev</button>
          <button type="button" class="btn btn-ghost sm" id="ws-fn">Next</button>
          <button type="button" class="btn btn-ghost sm" id="ws-r1">Replace</button>
          <button type="button" class="btn btn-ghost sm" id="ws-ra">Replace all</button>
          <button type="button" class="btn btn-ghost sm" id="ws-fx" aria-label="Close find">Close</button>
        </div>
        <div class="ws-empty card" id="ws-none"><p class="sub">No file is open. Pick a file on the left, or add one with <strong>+ File</strong>.</p></div>
        <div class="ws-editor" id="ws-editor">
          <pre class="ws-gut" id="ws-gut" aria-hidden="true"></pre>
          <div class="ws-code">
            <pre class="ws-layer" id="ws-fl" aria-hidden="true"></pre>
            <pre class="ws-layer" id="ws-hl" aria-hidden="true"></pre>
            <textarea id="ws-ta" class="ws-ta" spellcheck="false" wrap="off" autocomplete="off" autocapitalize="off" aria-label="Code editor. Press Escape, then Tab to leave the editor."></textarea>
          </div>
        </div>
        <div class="ws-status"><span id="ws-pos"></span><span id="ws-lang"></span><span id="ws-stat" role="status"></span></div>
        <div class="ws-bot">
          <div class="tabs" role="tablist" aria-label="Output">
            <button type="button" class="tab" role="tab" id="ws-tc" aria-current="true">Console</button>
            <button type="button" class="tab" role="tab" id="ws-tp" aria-current="false">Preview</button>
            <button type="button" class="btn btn-ghost sm ws-clear" id="ws-clr">Clear</button>
          </div>
          <div class="ws-con" id="ws-con" role="log" aria-live="polite" tabindex="0" aria-label="Console output"></div>
          <div class="ws-prev" id="ws-prev" hidden></div>
        </div>
      </div>
    </div>
    <dialog id="ws-nd" aria-labelledby="ws-ndh">
      <form id="ws-ndf" class="dlg-body" novalidate>
        <h2 id="ws-ndh">Name</h2>
        <div class="field"><label for="ws-ndi" id="ws-ndl">Name</label><input class="input" id="ws-ndi" maxlength="160" autocomplete="off"></div>
        <p class="error" id="ws-nde" role="alert"></p>
        <div class="dlg-actions"><span></span><span style="display:flex;gap:10px"><button type="button" class="btn btn-ghost sm" id="ws-ndx">Cancel</button><button type="submit" class="btn btn-primary sm">OK</button></span></div>
      </form>
    </dialog>
  </section>`);

  const view = $('ws-view'), ta = $('ws-ta'), hl = $('ws-hl'), fl = $('ws-fl'), gut = $('ws-gut');
  const nd = $('ws-nd'), con = $('ws-con'), prev = $('ws-prev');
  function setStatus(t) { const s = $('ws-stat'); if (s) s.textContent = t; }

  const tpl = $('ws-tpl');
  tpl.append(h('option', { value: '' }, 'Add from template…'), ...TEMPLATES.map((t, i) => h('option', { value: String(i) }, t[0])));
  tpl.addEventListener('change', () => {
    const t = TEMPLATES[Number(tpl.value)];
    tpl.value = '';
    if (!t) return;
    const name = baseOf(t[1]), dir = t[1].includes('/') ? dirOf(t[1]) : baseDir();
    const p = freeName(dir, name);
    if (blockedByFile(p)) return toast('A file is in the way of that folder.');
    ws.files[p] = t[2]; ws.sel = { path: p, dir: false };
    openFile(p); save();
  });

  /* ---------- Highlighting ---------- */
  const rxCache = {};
  function tokenRx(lang) {
    if (rxCache[lang] !== undefined) return rxCache[lang];
    const L = LANGS[lang];
    if (!L || !L.kw) { rxCache[lang] = null; return null; }
    const com = lang === 'py' ? String.raw`#[^\n]*` : (lang === 'json' ? '(?!)' : String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`);
    const q = String.raw`"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?`;
    const str = lang === 'py' ? String.raw`"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|` + q
      : lang === 'js' ? q + String.raw`|` + '`(?:\\\\.|[^`\\\\])*`?' : q;
    rxCache[lang] = new RegExp('(' + com + ')|(' + str + ')|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:' + L.kw.split(' ').join('|') + ')\\b)', 'g');
    return rxCache[lang];
  }
  function highlight(text, lang) {
    const rx = tokenRx(lang);
    if (!rx || text.length > 200000) return esc(text);
    rx.lastIndex = 0;
    let out = '', last = 0;
    text.replace(rx, (m, c, s, n, k, off) => {
      out += esc(text.slice(last, off)) + '<span class="t-' + (c ? 'c' : s ? 's' : n ? 'n' : 'k') + '">' + esc(m) + '</span>';
      last = off + m.length;
      return m;
    });
    return out + esc(text.slice(last));
  }

  /* ---------- Find ---------- */
  const FD = { open: false, q: '', i: 0, hits: [] };
  function findHits() {
    FD.hits = [];
    if (!FD.q || !ws.active) return;
    const t = ta.value.toLowerCase(), q = FD.q.toLowerCase();
    for (let i = t.indexOf(q); i !== -1 && FD.hits.length < 5000; i = t.indexOf(q, i + q.length)) FD.hits.push(i);
    if (FD.i >= FD.hits.length) FD.i = 0;
  }
  function drawFind() {
    const t = ta.value;
    if (!FD.open || !FD.hits.length) { fl.textContent = ''; $('ws-fc').textContent = FD.open && FD.q ? 'No matches' : ''; return; }
    let out = '', last = 0;
    FD.hits.forEach((s, n) => {
      out += esc(t.slice(last, s)) + '<mark' + (n === FD.i ? ' class="cur"' : '') + '>' + esc(t.slice(s, s + FD.q.length)) + '</mark>';
      last = s + FD.q.length;
    });
    fl.innerHTML = out + esc(t.slice(last)) + '\n';
    $('ws-fc').textContent = (FD.i + 1) + ' of ' + FD.hits.length;
  }
  function goHit() {
    if (!FD.hits.length) return;
    const idx = FD.hits[FD.i], line = ta.value.slice(0, idx).split('\n').length - 1;
    ta.scrollTop = Math.max(0, line * 20 - ta.clientHeight / 2);
    syncScroll();
  }
  function refind(go) { findHits(); drawFind(); if (go) goHit(); }
  function openFind(on) {
    FD.open = on;
    $('ws-find').hidden = !on;
    if (on) {
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel && !sel.includes('\n')) { $('ws-fi').value = sel; FD.q = sel; }
      $('ws-fi').focus(); $('ws-fi').select(); refind(true);
    } else { fl.textContent = ''; FD.hits = []; if (ws.active) ta.focus(); }
  }
  function step(d) { if (!FD.hits.length) return; FD.i = (FD.i + d + FD.hits.length) % FD.hits.length; drawFind(); goHit(); }
  function setValue(v) {
    ta.focus(); ta.select();
    if (!document.execCommand('insertText', false, v)) { ta.value = v; ta.dispatchEvent(new Event('input')); }
  }
  function replaceOne() {
    if (!FD.hits.length) return;
    const s = FD.hits[FD.i];
    ta.setRangeText($('ws-ri').value, s, s + FD.q.length, 'end');
    ta.dispatchEvent(new Event('input'));
  }
  function replaceAll() {
    if (!FD.hits.length) return;
    const rx = new RegExp(FD.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), r = $('ws-ri').value, n = FD.hits.length;
    ta.value = ta.value.replace(rx, () => r);
    ta.dispatchEvent(new Event('input'));
    toast('Replaced ' + n + (n === 1 ? ' match.' : ' matches.'));
  }
  $('ws-fi').addEventListener('input', () => { FD.q = $('ws-fi').value; FD.i = 0; refind(true); });
  $('ws-fi').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') openFind(false); });
  $('ws-ri').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } else if (e.key === 'Escape') openFind(false); });
  $('ws-fn').addEventListener('click', () => step(1));
  $('ws-fp').addEventListener('click', () => step(-1));
  $('ws-r1').addEventListener('click', replaceOne);
  $('ws-ra').addEventListener('click', replaceAll);
  $('ws-fx').addEventListener('click', () => openFind(false));
  $('ws-findbtn').addEventListener('click', () => { if (ws.active) openFind(true); });

  /* ---------- Editor ---------- */
  const scrolls = {};
  function syncScroll() {
    gut.scrollTop = ta.scrollTop; hl.scrollTop = ta.scrollTop; fl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft; fl.scrollLeft = ta.scrollLeft;
  }
  function refreshEditor() {
    const lang = ws.active ? langOf(ws.active) : 'txt';
    hl.innerHTML = highlight(ta.value, lang) + '\n';
    const n = ta.value.split('\n').length;
    if (gut.dataset.n !== String(n)) { gut.dataset.n = String(n); gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
    if (FD.open) refind(false);
    syncScroll();
  }
  function drawPos() {
    if (!ws.active) { $('ws-pos').textContent = ''; $('ws-lang').textContent = ''; return; }
    const before = ta.value.slice(0, ta.selectionStart).split('\n');
    $('ws-pos').textContent = 'Ln ' + before.length + ', Col ' + (before[before.length - 1].length + 1);
    $('ws-lang').textContent = LANGS[langOf(ws.active)].n;
  }
  function loadEditor() {
    const f = ws.active;
    $('ws-none').hidden = !!f;
    $('ws-editor').hidden = !f;
    ['ws-run', 'ws-prevbtn', 'ws-fmt', 'ws-findbtn', 'ws-dl'].forEach((id) => { $(id).disabled = !f; });
    if (!f) { ta.value = ''; refreshEditor(); drawPos(); return; }
    ta.value = ws.files[f];
    gut.dataset.n = '';
    refreshEditor();
    ta.scrollTop = scrolls[f] || 0; syncScroll();
    drawPos();
  }
  ta.addEventListener('scroll', syncScroll);
  ta.addEventListener('input', () => {
    if (!ws.active) return;
    ws.files[ws.active] = ta.value;
    refreshEditor(); drawPos(); saveSoon();
  });
  ['keyup', 'click', 'focus'].forEach((ev) => ta.addEventListener(ev, drawPos));
  ta.addEventListener('blur', () => { noTab = false; if (ws.active) scrolls[ws.active] = ta.scrollTop; });

  function insert(start, end, text, selA, selB) {
    ta.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) { ta.setRangeText(text, start, end, 'end'); ta.dispatchEvent(new Event('input')); }
    ta.setSelectionRange(selA, selB == null ? selA : selB);
    drawPos();
  }
  function lineBlock() {
    const v = ta.value, a = ta.selectionStart; let b = ta.selectionEnd;
    if (b > a && v[b - 1] === '\n') b--;
    const s = v.lastIndexOf('\n', a - 1) + 1, e0 = v.indexOf('\n', b);
    return { s, e: e0 === -1 ? v.length : e0 };
  }
  function indentLines(out) {
    const { s, e } = lineBlock(), a = ta.selectionStart, b = ta.selectionEnd;
    const lines = ta.value.slice(s, e).split('\n');
    let first = 0, total = 0;
    const next = lines.map((l, i) => {
      let r = l;
      if (!out) r = '  ' + l;
      else if (l.startsWith('  ')) r = l.slice(2);
      else if (l.startsWith('\t') || l.startsWith(' ')) r = l.slice(1);
      const d = r.length - l.length;
      if (i === 0) first = d;
      total += d;
      return r;
    });
    insert(s, e, next.join('\n'), Math.max(s, a + first), Math.max(s, b + total));
  }
  function toggleComment() {
    const lang = langOf(ws.active || ''), c = LANGS[lang].c;
    if (!c) return;
    const { s, e } = lineBlock(), a = ta.selectionStart, b = ta.selectionEnd;
    const lines = ta.value.slice(s, e).split('\n');
    const all = lines.every((l) => !l.trim() || l.trimStart().startsWith(c));
    let first = 0, total = 0;
    const next = lines.map((l, i) => {
      let r = l;
      if (l.trim()) {
        const ind = /^\s*/.exec(l)[0];
        r = all ? ind + l.slice(ind.length).replace(c + ' ', '').replace(c, '') : ind + c + ' ' + l.slice(ind.length);
      }
      const d = r.length - l.length;
      if (i === 0) first = d;
      total += d;
      return r;
    });
    insert(s, e, next.join('\n'), Math.max(s, a + first), Math.max(s, b + total));
  }
  let noTab = false;
  ta.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    if (mod && k.toLowerCase() === 's') { e.preventDefault(); save(); toast('Saved.'); return; }
    if (mod && k.toLowerCase() === 'f') { e.preventDefault(); openFind(true); return; }
    if (mod && k === 'Enter') { e.preventDefault(); run(); return; }
    if (mod && k === '/') { e.preventDefault(); toggleComment(); return; }
    if (k === 'Escape') { noTab = true; return; }
    if (k === 'Tab' && !mod && !e.altKey) {
      if (noTab) { noTab = false; return; }
      e.preventDefault();
      const multi = ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n');
      if (multi || e.shiftKey) indentLines(e.shiftKey);
      else insert(ta.selectionStart, ta.selectionEnd, '  ', ta.selectionStart + 2);
      return;
    }
    noTab = false;
    if (k === 'Enter' && !mod && !e.shiftKey && !e.altKey && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      const v = ta.value, p = ta.selectionStart, ls = v.lastIndexOf('\n', p - 1) + 1;
      const before = v.slice(ls, p), ind = /^[ \t]*/.exec(before)[0], t = before.trimEnd();
      const more = /[{(\[]$/.test(t) || (langOf(ws.active || '') === 'py' && /:$/.test(t)) ? '  ' : '';
      if (more && /[})\]]/.test(v[p] || '')) insert(p, p, '\n' + ind + more + '\n' + ind, p + 1 + ind.length + more.length);
      else insert(p, p, '\n' + ind + more, p + 1 + ind.length + more.length);
    }
  });

  /* ---------- Tabs and open files ---------- */
  function drawTabs() {
    const box = $('ws-tabs');
    box.replaceChildren(...ws.open.map((p) => h('div', { class: 'ws-tab', 'data-p': p },
      h('button', { type: 'button', role: 'tab', class: 'ws-tabb', 'aria-current': String(p === ws.active), title: p, onclick: () => openFile(p) }, baseOf(p)),
      h('button', { type: 'button', class: 'ws-x', 'aria-label': 'Close ' + baseOf(p), onclick: () => closeTab(p) }, '×'))));
  }
  function openFile(p) {
    if (ws.active && ws.active !== p) scrolls[ws.active] = ta.scrollTop;
    if (!ws.open.includes(p)) ws.open.push(p);
    ws.active = p; ws.sel = { path: p, dir: false };
    loadEditor(); drawTabs(); drawTree(); saveSoon();
    if (view.style.display !== 'none') ta.focus();
  }
  function closeTab(p) {
    const i = ws.open.indexOf(p);
    if (i < 0) return;
    ws.open.splice(i, 1);
    if (ws.active === p) ws.active = ws.open[Math.min(i, ws.open.length - 1)] || null;
    loadEditor(); drawTabs(); drawTree(); saveSoon();
  }

  /* ---------- File tree ---------- */
  function drawTree() {
    const dirs = allDirs(), paths = Object.keys(ws.files);
    function level(dir, depth) {
      const prefix = dir ? dir + '/' : '';
      const sub = Array.from(dirs).filter((d) => dirOf(d) === dir).sort(nat);
      const fs = paths.filter((p) => dirOf(p) === dir).sort(nat);
      const out = [];
      sub.forEach((d) => {
        const open = !ws.collapsed.includes(d);
        out.push(h('div', { class: 'ws-row', style: '--d:' + depth },
          h('button', { type: 'button', class: 'ws-item', 'aria-expanded': String(open), 'aria-current': String(!!ws.sel && ws.sel.dir && ws.sel.path === d), onclick: () => {
            ws.sel = { path: d, dir: true };
            ws.collapsed = open ? ws.collapsed.concat(d) : ws.collapsed.filter((x) => x !== d);
            drawTree(); saveSoon();
          } }, h('span', { class: 'ws-ic', 'aria-hidden': 'true' }, open ? '▾' : '▸'), baseOf(d))));
        if (open) out.push(...level(d, depth + 1));
      });
      fs.forEach((p) => out.push(h('div', { class: 'ws-row', style: '--d:' + depth },
        h('button', { type: 'button', class: 'ws-item', 'aria-current': String(!!ws.sel && !ws.sel.dir && ws.sel.path === p), onclick: () => openFile(p) },
          h('span', { class: 'ws-ic', 'aria-hidden': 'true' }, '·'), baseOf(p)))));
      void prefix;
      return out;
    }
    const rows = level('', 0);
    $('ws-tree').replaceChildren(...(rows.length ? rows : [h('p', { class: 'sub ws-none' }, 'No files yet. Use + File.')]));
  }

  /* ---------- Name dialog ---------- */
  let ndCb = null;
  function ask(title, label, value, ok) {
    $('ws-ndh').textContent = title; $('ws-ndl').textContent = label;
    const i = $('ws-ndi'); i.value = value; $('ws-nde').textContent = ''; ndCb = ok;
    nd.showModal(); i.focus(); i.select();
  }
  $('ws-ndf').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = ndCb ? ndCb($('ws-ndi').value.trim()) : null;
    if (err) { $('ws-nde').textContent = err; $('ws-ndi').focus(); return; }
    nd.close();
  });
  $('ws-ndx').addEventListener('click', () => nd.close());

  function newItem(isDir) {
    const dir = baseDir();
    ask(isDir ? 'New folder' : 'New file', (isDir ? 'Folder name' : 'File name') + (dir ? ' (inside ' + dir + ')' : ''), isDir ? 'new-folder' : 'untitled.js', (v) => {
      if (!v) return 'Enter a name.';
      const p = cleanPath(dir ? dir + '/' + v : v);
      if (!p) return 'That name is not allowed. Avoid : * ? " < > | and empty parts.';
      if (taken(p)) return 'Something with that name already exists.';
      if (blockedByFile(p)) return 'A file with the same name as one of those folders exists.';
      if (isDir) { ws.dirs.push(p); ws.sel = { path: p, dir: true }; ws.collapsed = ws.collapsed.filter((x) => x !== dir); drawTree(); save(); }
      else { ws.files[p] = ''; ws.sel = { path: p, dir: false }; openFile(p); save(); }
      return null;
    });
  }
  function remap(oldP, newP) {
    const mv = (p) => (p === oldP ? newP : p.startsWith(oldP + '/') ? newP + p.slice(oldP.length) : p);
    const files = Object.create(null);
    Object.keys(ws.files).forEach((p) => { files[mv(p)] = ws.files[p]; });
    ws.files = files;
    ws.dirs = ws.dirs.map(mv); ws.open = ws.open.map(mv); ws.collapsed = ws.collapsed.map(mv);
    if (ws.active) ws.active = mv(ws.active);
    if (ws.sel) ws.sel.path = mv(ws.sel.path);
  }
  function renameItem() {
    const s = ws.sel;
    if (!s) return toast('Select a file or folder first.');
    const old = s.path;
    ask('Rename', 'New name', baseOf(old), (v) => {
      if (!v) return 'Enter a name.';
      if (/[\\/]/.test(v)) return 'Use a name without slashes.';
      const np = cleanPath(dirOf(old) ? dirOf(old) + '/' + v : v);
      if (!np) return 'That name is not allowed.';
      if (np === old) return null;
      if (taken(np)) return 'Something with that name already exists.';
      remap(old, np); loadEditor(); drawTabs(); drawTree(); save();
      return null;
    });
  }
  function deleteItem() {
    const s = ws.sel;
    if (!s) return toast('Select a file or folder first.');
    const p = s.path, inside = (x) => x === p || x.startsWith(p + '/');
    const n = Object.keys(ws.files).filter(inside).length;
    if (!confirm(s.dir ? 'Delete the folder ' + p + (n ? ' and its ' + n + (n === 1 ? ' file' : ' files') : '') + '? This can’t be undone.' : 'Delete ' + p + '? This can’t be undone.')) return;
    Object.keys(ws.files).forEach((x) => { if (inside(x)) delete ws.files[x]; });
    ws.dirs = ws.dirs.filter((x) => !inside(x)); ws.collapsed = ws.collapsed.filter((x) => !inside(x));
    ws.open = ws.open.filter((x) => !inside(x));
    if (ws.active && inside(ws.active)) ws.active = ws.open[0] || null;
    ws.sel = null;
    loadEditor(); drawTabs(); drawTree(); save();
  }
  $('ws-nf').addEventListener('click', () => newItem(false));
  $('ws-nd-btn').addEventListener('click', () => newItem(true));
  $('ws-rn').addEventListener('click', renameItem);
  $('ws-del').addEventListener('click', deleteItem);

  /* ---------- Output panel ---------- */
  function showPane(which) {
    const isCon = which === 'con';
    con.hidden = !isCon; prev.hidden = isCon;
    $('ws-tc').setAttribute('aria-current', String(isCon)); $('ws-tp').setAttribute('aria-current', String(!isCon));
  }
  $('ws-tc').addEventListener('click', () => showPane('con'));
  $('ws-tp').addEventListener('click', () => showPane('prev'));
  $('ws-clr').addEventListener('click', () => { con.replaceChildren(); prev.replaceChildren(); });
  function line(kind, text) {
    if (con.childElementCount >= 500) { if (con.childElementCount === 500) con.append(h('div', { class: 'ws-ln ws-warn' }, 'Output limit reached (500 lines).')); return; }
    con.append(h('div', { class: 'ws-ln ws-' + kind }, text));
    con.scrollTop = con.scrollHeight;
  }

  /* ---------- Run JavaScript in an isolated worker ---------- */
  let worker = null, workerTimer = 0;
  function stopWorker() { if (worker) { worker.terminate(); worker = null; } clearTimeout(workerTimer); }
  const PRE = "const __p=(t,a)=>postMessage({t,a:a.map(x=>{try{return typeof x==='string'?x:(x instanceof Error?(x.stack||String(x)):(JSON.stringify(x,null,2)??String(x)))}catch(e){return String(x)}})});" +
    "const __c={log:(...a)=>__p('log',a),info:(...a)=>__p('info',a),warn:(...a)=>__p('warn',a),error:(...a)=>__p('error',a),table:(...a)=>__p('log',a)};" +
    "self.addEventListener('unhandledrejection',e=>__p('error',[e.reason]));";
  function runJs(code) {
    stopWorker();
    showPane('con'); con.replaceChildren();
    line('info', '▶ Running ' + ws.active + ' …');
    const t0 = performance.now();
    const src = PRE + '\n(async function(console){' + code + '\n})(__c).then(()=>postMessage({t:"done"}),e=>__p("error",[e]));';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    let done = false;
    try { worker = new Worker(url); } catch (e) { URL.revokeObjectURL(url); return line('error', 'This browser blocked the script runner.'); }
    const w = worker;
    URL.revokeObjectURL(url);
    w.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.t === 'done') { done = true; line('info', '✔ Finished in ' + Math.round(performance.now() - t0) + ' ms'); }
      else if (Array.isArray(m.a)) line(m.t === 'error' ? 'error' : m.t === 'warn' ? 'warn' : 'log', m.a.join(' '));
    };
    w.onerror = (ev) => {
      ev.preventDefault();
      const ln = ev.lineno > 1 ? ' (line ' + (ev.lineno - 1) + ')' : '';
      line('error', (ev.message || 'Script error') + ln);
      done = true; stopWorker();
    };
    workerTimer = setTimeout(() => {
      if (worker === w) { stopWorker(); if (!done) line('warn', '■ Stopped: the script ran for more than ' + RUN_LIMIT / 1000 + ' seconds.'); }
    }, RUN_LIMIT);
  }
  function resolveHtml(html, path) {
    const base = dirOf(path);
    const find = (ref) => {
      if (/^[a-z]+:|^\/\//i.test(ref)) return null;
      const parts = (base ? base + '/' : '').split('/').concat(ref.split('/')).filter((s) => s && s !== '.');
      const out = [];
      parts.forEach((s) => { if (s === '..') out.pop(); else out.push(s); });
      const p = out.join('/');
      return ws.files[p] !== undefined ? ws.files[p] : null;
    };
    return html
      .replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, a, ref, b) => { const c = find(ref); return c == null ? m : '<script' + a + b + '>' + c.replace(/<\/script/gi, '<\\/script') + '<\/script>'; })
      .replace(/<link\b[^>]*?href=["']([^"']+\.css)["'][^>]*>/gi, (m, ref) => { const c = find(ref); return c == null ? m : '<style>' + c.replace(/<\/style/gi, '<\\/style') + '</style>'; });
  }
  function preview() {
    if (!ws.active) return;
    if (langOf(ws.active) !== 'html') return toast('Preview works for HTML files.');
    showPane('prev');
    const f = h('iframe', { sandbox: 'allow-scripts allow-forms allow-modals', title: 'Preview of ' + baseOf(ws.active), class: 'ws-frame' });
    f.srcdoc = resolveHtml(ta.value, ws.active);
    prev.replaceChildren(f);
  }
  function run() {
    if (!ws.active) return;
    const lang = langOf(ws.active);
    if (lang === 'js') return runJs(ta.value);
    if (lang === 'html') return preview();
    showPane('con');
    con.replaceChildren();
    line('warn', LANGS[lang].n + ' files are edit-only for now. Run works for JavaScript; use Preview for HTML.');
  }
  $('ws-run').addEventListener('click', run);
  $('ws-prevbtn').addEventListener('click', preview);
  $('ws-fmt').addEventListener('click', () => {
    if (!ws.active) return;
    if (langOf(ws.active) !== 'json') return toast('Format works for JSON files.');
    try { setValue(JSON.stringify(JSON.parse(ta.value), null, 2) + '\n'); toast('Formatted.'); }
    catch (e) { showPane('con'); con.replaceChildren(); line('error', 'Invalid JSON: ' + e.message); }
  });
  $('ws-dl').addEventListener('click', () => { if (ws.active) download(baseOf(ws.active), ta.value, MIME[langOf(ws.active)] || 'text/plain'); });

  /* ---------- Show / hide with the other modules ---------- */
  const btn = $('ws-btn');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  const others = ['tools', 'test', 'au', 'hs', 'rl', 'jr'];
  const otherViews = ['tools-view', 'test-view', 'auto-view', 'hist-view', 'rel-view', 'jira-view'];
  function show(on) {
    if (on) {
      reportEls.forEach((el) => { if (!view.contains(el)) el.style.display = 'none'; });
      otherViews.forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
      others.forEach((p) => { const b = $(p + '-btn'); if (b) b.setAttribute('aria-current', 'false'); });
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
    } else stopWorker();
    view.style.display = on ? '' : 'none';
    btn.setAttribute('aria-current', String(on));
    if (on) { loadEditor(); drawTabs(); drawTree(); }
  }
  btn.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => show(false)));
  others.forEach((p) => { const b = $(p + '-btn'); if (b) b.addEventListener('click', () => show(false)); });
  window.addEventListener('beforeunload', () => { if (saveTimer) save(); });

  window.BWorkspace = { getFiles: () => Object.assign({}, ws.files) };
  loadEditor(); drawTabs(); drawTree();
})();