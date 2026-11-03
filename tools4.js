(function () {
  const grid = document.querySelector('#tools-view .tools-grid');
  if (!grid) return;
  const $ = (id) => document.getElementById(id);
  const FENCE = '\u0060\u0060\u0060';

  /* ---------- Markup ---------- */
  grid.insertAdjacentHTML('beforeend', `
    <article class="tool wide">
      <h2>cURL command builder</h2>
      <p class="desc">Describe the request that fails and get a command anyone on your team can run to reproduce it. Nothing is sent from here.</p>
      <div class="mu">
        <div class="field"><label for="u-method">Method</label>
          <select class="input" id="u-method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option></select></div>
        <div class="field"><label for="u-url">URL</label><input class="input" id="u-url" inputmode="url" spellcheck="false" placeholder="https://api.example.com/v1/orders"></div>
      </div>
      <div class="eq">
        <div class="field"><label for="u-hdr">Headers (one per line)</label><textarea class="input mono" id="u-hdr" rows="5" spellcheck="false" placeholder="Authorization: Bearer abc123&#10;Accept: application/json"></textarea></div>
        <div class="field"><label for="u-body">Body (optional)</label><textarea class="input mono" id="u-body" rows="5" spellcheck="false" placeholder='{"item":"book","qty":2}'></textarea></div>
      </div>
      <div class="field"><label for="u-shell">Command style</label>
        <select class="input" id="u-shell"><option value="bash">Bash (macOS, Linux, Git Bash)</option><option value="cmd">Windows CMD</option></select></div>
      <div class="tool-actions" style="gap:8px 18px">
        <label class="opt"><input type="checkbox" id="u-L"> Follow redirects</label>
        <label class="opt"><input type="checkbox" id="u-i"> Show response headers</label>
        <label class="opt"><input type="checkbox" id="u-json" checked> Add JSON Content-Type if missing</label>
        <label class="opt"><input type="checkbox" id="u-mask" checked> Hide secrets when adding to the report</label>
      </div>
      <p class="error" id="u-err"></p>
      <pre class="out" id="u-out" hidden aria-live="polite"></pre>
      <p class="stat-line" id="u-note" aria-live="polite"></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-primary sm" id="u-copy">Copy command</button>
        <button type="button" class="btn btn-ghost sm" id="u-add">Add to report writer</button>
      </div>
    </article>

    <article class="tool wide">
      <h2>Diff checker</h2>
      <p class="desc">Paste what you expected and what you got to see exactly which lines differ.</p>
      <div class="eq">
        <div class="field"><label for="df-a">Expected</label><textarea class="input mono" id="df-a" rows="7" spellcheck="false" placeholder="Total: 42.00&#10;Status: paid"></textarea></div>
        <div class="field"><label for="df-b">Actual</label><textarea class="input mono" id="df-b" rows="7" spellcheck="false" placeholder="Total: 24.00&#10;Status: paid"></textarea></div>
      </div>
      <div class="tool-actions" style="gap:8px 18px">
        <label class="opt"><input type="checkbox" id="df-ws"> Ignore extra spaces</label>
        <label class="opt"><input type="checkbox" id="df-case"> Ignore upper and lower case</label>
      </div>
      <p class="error" id="df-err"></p>
      <div class="diff" id="df-out" hidden aria-label="Differences between expected and actual"></div>
      <p class="stat-line" id="df-stat" aria-live="polite"></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost sm" id="df-swap">Swap sides</button>
        <button type="button" class="btn btn-primary sm" id="df-add">Add diff to report writer</button>
      </div>
    </article>

    <article class="tool wide">
      <h2>Markdown previewer</h2>
      <p class="desc">See how a report will look in GitHub or Jira. Load the one from the report writer or paste your own.</p>
      <div class="eq">
        <div class="field"><label for="m-in">Markdown</label><textarea class="input mono" id="m-in" rows="10" spellcheck="false" placeholder="## Title&#10;**Severity:** High&#10;&#10;1. First step&#10;2. Second step"></textarea></div>
        <div class="field"><label id="m-label">Preview</label><div class="md" id="m-prev" role="region" aria-labelledby="m-label" aria-live="polite"></div></div>
      </div>
      <div class="tool-actions">
        <button type="button" class="btn btn-primary sm" id="m-load">Load current report</button>
        <button type="button" class="btn btn-ghost sm" id="m-copy">Copy Markdown</button>
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
  function appendToActual(block) {
    const act = $('w-act');
    if (!act) { toast('Report writer not found'); return false; }
    act.value = (act.value.trim() ? act.value.trim() + '\n\n' : '') + block;
    fire(act);
    toast('Added to the report writer');
    return true;
  }

  /* ---------- cURL command builder ---------- */
  const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|x-api-key|api-key|x-auth-token)$/i;
  const SECRET_QUERY = /([?&][^=&#]*(?:token|key|secret|password|auth|sig)[^=&#]*=)[^&#]*/gi;

  function build(mask) {
    const url = $('u-url').value.trim();
    const method = $('u-method').value;
    const shell = $('u-shell').value;
    const notes = [];
    if (!url) return { empty: true };

    let parsed;
    try { parsed = new URL(url); } catch (e) { return { error: 'Enter a full URL that starts with http:// or https://.' }; }
    if (!/^https?:$/.test(parsed.protocol)) return { error: 'Enter a full URL that starts with http:// or https://.' };

    const headers = [];
    const lines = $('u-hdr').value.split(/\r?\n/);
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n].trim();
      if (!line) continue;
      const idx = line.indexOf(':');
      const name = idx > 0 ? line.slice(0, idx).trim() : '';
      if (!name || !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) {
        return { error: 'Header on line ' + (n + 1) + ' should look like Name: value.' };
      }
      headers.push([name, line.slice(idx + 1).trim()]);
    }

    let body = $('u-body').value;
    const sendsBody = method !== 'GET' && method !== 'HEAD';
    if (body.trim() && !sendsBody) {
      notes.push(method + ' requests don’t send a body, so it was left out.');
      body = '';
    }
    let isJson = false;
    if (body.trim()) { try { JSON.parse(body); isJson = true; } catch (e) {} }
    if (shell === 'cmd' && /\n/.test(body)) {
      if (isJson) body = JSON.stringify(JSON.parse(body));
      else {
        body = body.replace(/\r?\n/g, ' ');
        notes.push('Line breaks in the body were replaced with spaces because CMD can’t take them inside a quoted value.');
      }
    }
    if (body.trim() && isJson && $('u-json').checked && !headers.some((h) => h[0].toLowerCase() === 'content-type')) {
      headers.push(['Content-Type', 'application/json']);
    }

    const maskedUrl = url.replace(SECRET_QUERY, '$1[redacted]');
    const shownUrl = mask ? maskedUrl : url;
    const q = shell === 'cmd'
      ? (s) => '"' + s.replace(/"/g, '\\"') + '"'
      : (s) => "'" + s.replace(/'/g, "'\\''") + "'";

    const parts = ['curl'];
    if (method === 'HEAD') parts.push('-I');
    else if ($('u-i').checked) parts.push('-i');
    if ($('u-L').checked) parts.push('-L');
    if (method !== 'GET' && method !== 'HEAD') parts.push('-X ' + method);
    headers.forEach(([k, v]) => parts.push('-H ' + q(k + ': ' + (mask && SECRET_HEADER.test(k) ? '[redacted]' : v))));
    if (body.trim()) parts.push('--data-raw ' + q(body));
    parts.push(q(shownUrl));

    const cont = shell === 'cmd' ? ' ^' : ' \\';
    return {
      text: parts.join(cont + '\n  '),
      notes: notes,
      shell: shell,
      hasSecret: headers.some((h) => SECRET_HEADER.test(h[0])) || maskedUrl !== url
    };
  }

  function drawCurl() {
    const out = $('u-out');
    $('u-err').textContent = ''; $('u-note').textContent = '';
    const r = build(false);
    if (r.empty) { out.hidden = true; out.textContent = ''; return; }
    if (r.error) { out.hidden = true; out.textContent = ''; $('u-err').textContent = r.error; return; }
    out.hidden = false; out.textContent = r.text;
    const notes = r.notes.slice();
    if (r.shell === 'cmd') notes.push('In CMD, characters such as % and ^ inside values may need extra escaping.');
    if (r.hasSecret) notes.push('This command contains credentials, so keep it private. “Add to report writer” can hide them.');
    $('u-note').textContent = notes.join(' ');
  }
  ['u-method', 'u-url', 'u-hdr', 'u-body', 'u-shell', 'u-L', 'u-i', 'u-json'].forEach((id) => {
    $(id).addEventListener('input', drawCurl);
    $(id).addEventListener('change', drawCurl);
  });
  $('u-copy').addEventListener('click', () => {
    const r = build(false);
    if (r.text) copy(r.text); else toast('Enter a valid URL first');
  });
  $('u-add').addEventListener('click', () => {
    const r = build($('u-mask').checked);
    if (!r.text) return toast('Enter a valid URL first');
    appendToActual('Request used:\n' + FENCE + '\n' + r.text + '\n' + FENCE);
  });

  /* ---------- Diff checker ---------- */
  const MAX_LINES = 1000;
  let lastOps = [];

  function toLines(s) {
    if (!s) return [];
    const l = s.replace(/\r\n?/g, '\n').split('\n');
    if (l.length && l[l.length - 1] === '') l.pop();
    return l;
  }
  function lcsDiff(a, b, ka, kb) {
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (ka[i] === kb[j]) { ops.push({ t: 'eq', text: a[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: 'del', text: a[i] }); i++; }
      else { ops.push({ t: 'add', text: b[j] }); j++; }
    }
    while (i < n) ops.push({ t: 'del', text: a[i++] });
    while (j < m) ops.push({ t: 'add', text: b[j++] });
    return ops;
  }
  function drawDiff() {
    const out = $('df-out');
    out.replaceChildren(); out.hidden = true;
    $('df-err').textContent = ''; $('df-stat').textContent = '';
    lastOps = [];

    const a = toLines($('df-a').value), b = toLines($('df-b').value);
    if (!a.length && !b.length) return;
    if (a.length > MAX_LINES || b.length > MAX_LINES) {
      $('df-err').textContent = 'Compare up to ' + MAX_LINES.toLocaleString() + ' lines at a time.';
      return;
    }
    const norm = (l) => {
      let s = l;
      if ($('df-ws').checked) s = s.trim().replace(/\s+/g, ' ');
      if ($('df-case').checked) s = s.toLowerCase();
      return s;
    };
    const ops = lcsDiff(a, b, a.map(norm), b.map(norm));
    lastOps = ops;

    const count = { add: 0, del: 0, eq: 0 };
    out.hidden = false;
    ops.forEach((o) => {
      count[o.t]++;
      const span = document.createElement('span');
      span.className = o.t === 'eq' ? '' : o.t;
      span.textContent = (o.t === 'add' ? '+ ' : o.t === 'del' ? '- ' : '  ') + o.text;
      out.append(span);
    });
    $('df-stat').textContent = (count.add || count.del)
      ? count.add + ' added, ' + count.del + ' removed, ' + count.eq + ' unchanged. Lines starting with - are expected, and lines starting with + are actual.'
      : 'No differences found.';
  }
  ['df-a', 'df-b', 'df-ws', 'df-case'].forEach((id) => {
    $(id).addEventListener('input', drawDiff);
    $(id).addEventListener('change', drawDiff);
  });
  $('df-swap').addEventListener('click', () => {
    const t = $('df-a').value;
    $('df-a').value = $('df-b').value;
    $('df-b').value = t;
    drawDiff();
  });
  $('df-add').addEventListener('click', () => {
    if (!lastOps.some((o) => o.t !== 'eq')) return toast('No differences to add');
    const ops = lastOps.length > 40 ? lastOps.filter((o) => o.t !== 'eq') : lastOps;
    const text = ops.map((o) => (o.t === 'add' ? '+ ' : o.t === 'del' ? '- ' : '  ') + o.text).join('\n');
    appendToActual('Expected (-) compared with actual (+):\n' + FENCE + 'diff\n' + text + '\n' + FENCE);
  });

  /* ---------- Markdown previewer (built with DOM nodes, never innerHTML) ---------- */
  function inline(text, parent) {
    const re = /`([^`\n]+)`|\*\*(.+?)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.append(text.slice(last, m.index));
      if (m[1] !== undefined) {
        const c = document.createElement('code'); c.textContent = m[1]; parent.append(c);
      } else if (m[2] !== undefined) {
        const s = document.createElement('strong'); inline(m[2], s); parent.append(s);
      } else if (m[3] !== undefined) {
        const e = document.createElement('em'); e.textContent = m[3]; parent.append(e);
      } else {
        let href = null;
        try {
          const u = new URL(m[5]);
          if (['http:', 'https:', 'mailto:'].includes(u.protocol)) href = u.href;
        } catch (e) {}
        if (href) {
          const a = document.createElement('a');
          a.href = href; a.textContent = m[4];
          a.target = '_blank'; a.rel = 'noopener noreferrer';
          parent.append(a);
        } else parent.append(m[4]);
      }
      last = re.lastIndex;
    }
    if (last < text.length) parent.append(text.slice(last));
  }

  function renderMd(src, root) {
    root.replaceChildren();
    if (!src.trim()) {
      const p = document.createElement('p');
      p.className = 'sub'; p.textContent = 'The preview appears here.';
      root.append(p);
      return;
    }
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const special = (l) => /^\s*(```|#{1,4}\s|[-*]\s|\d+\.\s|>|-{3,}\s*$)/.test(l);
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }

      if (/^\s*```/.test(l)) {
        i++;
        const buf = [];
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        const pre = document.createElement('pre'), code = document.createElement('code');
        code.textContent = buf.join('\n');
        pre.append(code); root.append(pre);
        continue;
      }
      let m = l.match(/^(#{1,4})\s+(.*)$/);
      if (m) {
        const h = document.createElement('h' + (m[1].length + 2));
        inline(m[2], h); root.append(h); i++;
        continue;
      }
      if (/^\s*-{3,}\s*$/.test(l)) { root.append(document.createElement('hr')); i++; continue; }
      if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) {
        const ordered = /^\s*\d+\.\s+/.test(l);
        const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
        const list = document.createElement(ordered ? 'ol' : 'ul');
        while (i < lines.length && (m = lines[i].match(re))) {
          const li = document.createElement('li'); inline(m[1], li); list.append(li); i++;
        }
        root.append(list);
        continue;
      }
      if (/^>/.test(l)) {
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
        const bq = document.createElement('blockquote'), p = document.createElement('p');
        buf.forEach((t, n) => { if (n) p.append(document.createElement('br')); inline(t, p); });
        bq.append(p); root.append(bq);
        continue;
      }
      const p = document.createElement('p');
      inline(l, p); i++;
      while (i < lines.length && lines[i].trim() && !special(lines[i])) {
        p.append(document.createElement('br'));
        inline(lines[i], p); i++;
      }
      root.append(p);
    }
  }

  const drawMd = () => renderMd($('m-in').value, $('m-prev'));
  $('m-in').addEventListener('input', drawMd);
  $('m-load').addEventListener('click', () => {
    const src = $('w-out');
    if (!src || !src.textContent.trim()) return toast('The report writer is empty');
    $('m-in').value = src.textContent;
    drawMd();
  });
  $('m-copy').addEventListener('click', () => { if ($('m-in').value) copy($('m-in').value); else toast('Nothing to copy yet'); });
  drawMd();
})();