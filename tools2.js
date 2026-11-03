(function () {
  const grid = document.querySelector('#tools-view .tools-grid');
  if (!grid) return;
  const $ = (id) => document.getElementById(id);
  const SEV = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  const STATUS = { open: 'Open', progress: 'In progress', resolved: 'Resolved' };
  const FENCE = '\u0060\u0060\u0060';

  /* ---------- Markup ---------- */
  grid.insertAdjacentHTML('beforeend', `
    <article class="tool wide" id="a-card">
      <h2>Screenshot annotator</h2>
      <p class="desc">Upload, drop or paste (Ctrl+V) a screenshot, then mark the problem. Use Hide to black out private details before you share it.</p>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost sm" id="a-up">Upload image</button>
        <input type="file" id="a-file" accept="image/*" hidden>
        <button type="button" class="btn btn-ghost sm" data-a="pen" aria-pressed="true">Pen</button>
        <button type="button" class="btn btn-ghost sm" data-a="box" aria-pressed="false">Box</button>
        <button type="button" class="btn btn-ghost sm" data-a="arrow" aria-pressed="false">Arrow</button>
        <button type="button" class="btn btn-ghost sm" data-a="hide" aria-pressed="false">Hide</button>
        <button type="button" class="btn btn-ghost sm" id="a-undo">Undo</button>
        <button type="button" class="btn btn-ghost sm" id="a-clear">Clear</button>
        <button type="button" class="btn btn-primary sm" id="a-save">Download PNG</button>
      </div>
      <div class="drop" id="a-empty">Drop an image here, or press Ctrl+V to paste a screenshot</div>
      <canvas class="cv" id="a-cv" hidden aria-label="Screenshot annotation canvas"></canvas>
    </article>

    <article class="tool wide">
      <h2>Console log cleaner</h2>
      <p class="desc">Paste a noisy log, then tidy it and hide private details before adding it to a report.</p>
      <textarea class="input mono" id="l-in" spellcheck="false" placeholder="2026-11-03 10:14:02 ERROR Failed to load /api/user"></textarea>
      <div class="tool-actions" style="gap:8px 18px">
        <label class="opt"><input type="checkbox" id="l-ts" checked> Remove timestamps</label>
        <label class="opt"><input type="checkbox" id="l-dup" checked> Merge repeated lines</label>
        <label class="opt"><input type="checkbox" id="l-mask" checked> Mask emails, IPs and tokens</label>
        <label class="opt"><input type="checkbox" id="l-err"> Errors and warnings only</label>
      </div>
      <textarea class="input mono" id="l-out" readonly aria-label="Cleaned log"></textarea>
      <p class="stat-line" id="l-stat" aria-live="polite"></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost sm" id="l-copy">Copy cleaned log</button>
        <button type="button" class="btn btn-primary sm" id="l-add">Add to report writer</button>
      </div>
    </article>

    <article class="tool">
      <h2>Duplicate bug checker</h2>
      <p class="desc">Type a bug title to see if something similar is already in your reports.</p>
      <div class="field"><label for="d-in">Bug title</label><input class="input" id="d-in" placeholder="Checkout button not working on Safari"></div>
      <p class="stat-line" id="d-note" aria-live="polite"></p>
      <ul class="matches" id="d-out"></ul>
    </article>

    <article class="tool">
      <h2>Report templates</h2>
      <p class="desc">Pick a common bug type to pre-fill the report writer. You can edit everything afterwards.</p>
      <div class="field"><label for="p-sel">Template</label><select class="input" id="p-sel"></select></div>
      <div class="tool-actions"><button type="button" class="btn btn-primary sm" id="p-use">Use this template</button></div>
    </article>

    <article class="tool">
      <h2>Timestamp converter</h2>
      <p class="desc">Turn a Unix timestamp from a log into a readable date, or the other way round.</p>
      <div class="field"><label for="t-in">Unix time or a date</label><input class="input" id="t-in" placeholder="1793588089 or 2026-11-03 14:30"></div>
      <p class="error" id="t-err"></p>
      <dl class="kv" id="t-out"></dl>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost sm" id="t-now">Use current time</button>
        <button type="button" class="btn btn-ghost sm" id="t-copy">Copy UTC time</button>
      </div>
    </article>
  `);

  /* ---------- Helpers ---------- */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.remove(), 1800);
  }
  function copy(text) {
    const done = () => toast('Copied to clipboard');
    function fallback() {
      const t = document.createElement('textarea');
      t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.append(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      t.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  const fire = (el) => el.dispatchEvent(new Event('input', { bubbles: true }));
  const reports = () => (window.BBuddy ? window.BBuddy.getReports() : []);

  /* ---------- Screenshot annotator ---------- */
  const cv = $('a-cv');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const COLOR = '#e5252a';
  let tool = 'pen', drawing = false, hasImg = false;
  let sx = 0, sy = 0, lx = 0, ly = 0, snap = null, undo = [];

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return toast('Choose an image file');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, 1000 / img.width);
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      undo = []; hasImg = true;
      cv.hidden = false; $('a-empty').hidden = true;
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Couldn’t read that image'); };
    img.src = url;
  }
  function pt(e) {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height];
  }
  function style() {
    ctx.strokeStyle = COLOR; ctx.fillStyle = COLOR;
    ctx.lineWidth = Math.max(3, cv.width / 250);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }
  function arrow(x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = ctx.lineWidth * 4 + 8;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - 0.4), y2 - h * Math.sin(a - 0.4));
    ctx.lineTo(x2 - h * Math.cos(a + 0.4), y2 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }

  $('a-up').addEventListener('click', () => $('a-file').click());
  $('a-file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
  document.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.a;
    document.querySelectorAll('[data-a]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));

  cv.addEventListener('pointerdown', (e) => {
    if (!hasImg) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    [sx, sy] = pt(e); lx = sx; ly = sy;
    snap = ctx.getImageData(0, 0, cv.width, cv.height);
    undo.push(snap); if (undo.length > 15) undo.shift();
    drawing = true;
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = pt(e);
    style();
    if (tool === 'pen') {
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();
      lx = x; ly = y;
      return;
    }
    ctx.putImageData(snap, 0, 0);
    if (tool === 'box') ctx.strokeRect(sx, sy, x - sx, y - sy);
    else if (tool === 'hide') { ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, x - sx, y - sy); }
    else arrow(sx, sy, x, y);
  });
  const stop = () => { drawing = false; };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);

  $('a-undo').addEventListener('click', () => {
    const prev = undo.pop();
    if (prev) ctx.putImageData(prev, 0, 0); else toast('Nothing to undo');
  });
  $('a-clear').addEventListener('click', () => {
    hasImg = false; undo = [];
    cv.hidden = true; $('a-empty').hidden = false;
  });
  $('a-save').addEventListener('click', () => {
    if (!hasImg) return toast('Add an image first');
    cv.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = 'annotated-screenshot.png';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  });

  document.addEventListener('paste', (e) => {
    if ($('tools-view').style.display === 'none') return;
    const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
    const item = items.find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); loadFile(item.getAsFile()); }
  });
  const card = $('a-card');
  card.addEventListener('dragover', (e) => { e.preventDefault(); $('a-empty').classList.add('over'); });
  card.addEventListener('dragleave', () => $('a-empty').classList.remove('over'));
  card.addEventListener('drop', (e) => {
    e.preventDefault(); $('a-empty').classList.remove('over');
    loadFile(e.dataTransfer.files[0]);
  });

  /* ---------- Console log cleaner ---------- */
  const TS = [
    /^\s*\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?\s*/,
    /^\s*\[?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\]?\s*/
  ];
  function cleanLog() {
    let lines = $('l-in').value.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    const total = lines.length;
    if ($('l-ts').checked) lines = lines.map((l) => TS.reduce((s, re) => s.replace(re, ''), l));
    if ($('l-mask').checked) {
      lines = lines.map((l) => l
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
        .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [token]')
        .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]'));
    }
    lines = lines.filter((l) => l.trim());
    if ($('l-err').checked) {
      lines = lines.filter((l) => /\b(error|exception|fatal|warn(?:ing)?|fail(?:ed|ure)?|uncaught|traceback|denied|timeout)\b/i.test(l));
    }
    if ($('l-dup').checked) {
      const out = [];
      lines.forEach((l) => {
        const last = out[out.length - 1];
        if (last && last.text === l) last.n++; else out.push({ text: l, n: 1 });
      });
      lines = out.map((o) => (o.n > 1 ? o.text + '  (×' + o.n + ')' : o.text));
    }
    $('l-out').value = lines.join('\n');
    $('l-stat').textContent = total ? total + ' lines became ' + lines.length + '. Check the result for anything private before you share it.' : '';
  }
  ['l-in', 'l-ts', 'l-dup', 'l-mask', 'l-err'].forEach((id) => {
    $(id).addEventListener('input', cleanLog);
    $(id).addEventListener('change', cleanLog);
  });
  $('l-copy').addEventListener('click', () => { if ($('l-out').value) copy($('l-out').value); else toast('Nothing to copy yet'); });
  $('l-add').addEventListener('click', () => {
    const t = $('l-out').value.trim();
    if (!t) return toast('Nothing to add yet');
    const act = $('w-act');
    act.value = (act.value.trim() ? act.value.trim() + '\n\n' : '') + FENCE + '\n' + t + '\n' + FENCE;
    fire(act);
    toast('Added to the report writer');
  });

  /* ---------- Duplicate bug checker ---------- */
  const STOP = new Set('the and for with when after before from this that not does did app page are was its has have into onto over under'.split(' '));
  const toks = (s) => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, '')));

  function drawDup() {
    const list = $('d-out');
    list.replaceChildren();
    $('d-note').textContent = '';
    const q = toks($('d-in').value);
    if (!q.size) return;
    const rows = reports().map((r) => {
      const t = toks(r.title + ' ' + (r.desc || ''));
      let n = 0; q.forEach((w) => { if (t.has(w)) n++; });
      return { r, score: n / q.size };
    }).filter((x) => x.score >= 0.4).sort((a, b) => b.score - a.score).slice(0, 4);

    if (!rows.length) { $('d-note').textContent = 'No similar reports found. This looks new.'; return; }
    $('d-note').textContent = 'Possible duplicates:';
    rows.forEach(({ r, score }) => {
      const li = document.createElement('li'); li.className = 'match';
      const left = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = r.title;
      const sub = document.createElement('div'); sub.className = 'sub';
      sub.textContent = STATUS[r.status] + ' · ' + Math.round(score * 100) + '% match';
      left.append(title, sub);
      const badge = document.createElement('span');
      badge.className = 'badge sev-' + r.severity; badge.textContent = SEV[r.severity];
      li.append(left, badge);
      list.append(li);
    });
  }
  $('d-in').addEventListener('input', drawDup);

  /* ---------- Report templates ---------- */
  const TPL = {
    ui:      { name: 'UI or layout glitch', title: 'UI glitch: ', sev: 'medium', steps: 'Open the page\nResize the window or switch device\nLook at the affected area', exp: 'The layout looks correct and nothing overlaps', act: 'Elements overlap or are cut off' },
    crash:   { name: 'Crash or freeze', title: 'Crash: ', sev: 'critical', steps: 'Open the app\nPerform the action that triggers it', exp: 'The app keeps working', act: 'The app closes or stops responding' },
    slow:    { name: 'Slow performance', title: 'Slow: ', sev: 'medium', steps: 'Open the affected screen\nPerform the slow action\nNote how long it takes', exp: 'It finishes in under a second or two', act: 'It takes noticeably longer (add the time)' },
    login:   { name: 'Login or access problem', title: 'Login issue: ', sev: 'high', steps: 'Go to the sign-in page\nEnter valid details\nSelect Sign in', exp: 'I’m signed in and see my dashboard', act: 'I see an error or stay on the sign-in page' },
    data:    { name: 'Wrong data shown', title: 'Wrong data: ', sev: 'high', steps: 'Open the affected screen\nCompare the values with the source', exp: 'The values match the source', act: 'The values are missing, old or incorrect' },
    feature: { name: 'Feature not working', title: 'Not working: ', sev: 'medium', steps: 'Go to the feature\nUse it as described in the docs', exp: 'It does what the docs describe', act: 'Nothing happens or the result is wrong' }
  };
  const sel = $('p-sel');
  Object.keys(TPL).forEach((k) => {
    const o = document.createElement('option'); o.value = k; o.textContent = TPL[k].name; sel.append(o);
  });
  $('p-use').addEventListener('click', () => {
    const t = TPL[sel.value];
    [['w-title', t.title], ['w-sev', t.sev], ['w-steps', t.steps], ['w-exp', t.exp], ['w-act', t.act]].forEach(([id, v]) => {
      $(id).value = v; fire($(id));
    });
    const title = $('w-title');
    title.scrollIntoView({ block: 'center' });
    title.focus();
    title.setSelectionRange(title.value.length, title.value.length);
    toast('Template applied');
  });

  /* ---------- Timestamp converter ---------- */
  function parseTime(v) {
    v = v.trim();
    if (!v) return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) { const n = Number(v); return new Date(Math.abs(n) < 1e11 ? n * 1000 : n); }
    return new Date(v);
  }
  function rel(d) {
    const s = (d.getTime() - Date.now()) / 1000;
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    const f = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    for (const [u, n] of units) if (Math.abs(s) >= n || u === 'second') return f.format(Math.round(s / n), u);
  }
  function drawTime() {
    const out = $('t-out');
    out.replaceChildren();
    $('t-err').textContent = '';
    const d = parseTime($('t-in').value);
    if (d === null) return;
    if (isNaN(d.getTime())) { $('t-err').textContent = 'I couldn’t read that. Try a Unix timestamp or a date like 2026-11-03 14:30.'; return; }
    [
      ['UTC', d.toISOString()],
      ['Your time', d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })],
      ['Unix (s)', String(Math.floor(d.getTime() / 1000))],
      ['Unix (ms)', String(d.getTime())],
      ['Relative', rel(d)]
    ].forEach(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      out.append(dt, dd);
    });
  }
  $('t-in').addEventListener('input', drawTime);
  $('t-now').addEventListener('click', () => { $('t-in').value = String(Math.floor(Date.now() / 1000)); drawTime(); });
  $('t-copy').addEventListener('click', () => {
    const d = parseTime($('t-in').value);
    if (d && !isNaN(d.getTime())) copy(d.toISOString()); else toast('Enter a valid time first');
  });
})();