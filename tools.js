(function () {
  const main = document.querySelector('.main');
  const navList = document.querySelector('.nav-list');
  if (!main || !navList) return;
  const $ = (id) => document.getElementById(id);
  const SEV = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

  /* ---------- Markup ---------- */
  navList.insertAdjacentHTML('beforeend', '<button class="nav" id="tools-btn">Tools</button>');
  main.insertAdjacentHTML('beforeend', `
  <section id="tools-view" style="display:none">
    <header class="top"><div><h1>Tools</h1><p class="sub">Small helpers for writing, rating and sharing bug reports.</p></div></header>
    <div class="tools-grid">

      <article class="tool wide">
        <h2>Bug report writer</h2>
        <p class="desc">Fill in the details to get a report you can paste into GitHub, Jira or Slack.</p>
        <div class="two">
          <div class="field"><label for="w-title">Title</label><input class="input" id="w-title" maxlength="120" placeholder="Short summary of the problem"></div>
          <div class="field"><label for="w-sev">Severity</label>
            <select class="input" id="w-sev"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
        </div>
        <div class="field"><label for="w-steps">Steps to reproduce (one per line)</label><textarea class="input" id="w-steps" placeholder="Open the checkout page&#10;Tap Pay now"></textarea></div>
        <div class="two">
          <div class="field"><label for="w-exp">Expected result</label><textarea class="input" id="w-exp" placeholder="The payment goes through"></textarea></div>
          <div class="field"><label for="w-act">Actual result</label><textarea class="input" id="w-act" placeholder="Nothing happens"></textarea></div>
        </div>
        <label class="opt"><input type="checkbox" id="w-env" checked> Include my device and browser details</label>
        <pre class="out" id="w-out" aria-live="polite"></pre>
        <p class="error" id="w-err"></p>
        <div class="tool-actions">
          <button type="button" class="btn btn-ghost sm" id="w-copy">Copy as Markdown</button>
          <button type="button" class="btn btn-primary sm" id="w-save">Save to my reports</button>
        </div>
      </article>

      <article class="tool">
        <h2>Device and browser info</h2>
        <p class="desc">Detected from the browser you’re using right now.</p>
        <dl class="kv" id="e-list"></dl>
        <div class="tool-actions"><button type="button" class="btn btn-ghost sm" id="e-copy">Copy details</button></div>
      </article>

      <article class="tool">
        <h2>Severity helper</h2>
        <p class="desc">Answer four questions for a suggested severity.</p>
        <div class="field"><label for="v-imp">Who is affected?</label>
          <select class="input" id="v-imp"><option value="3">Almost everyone</option><option value="2" selected>Many users</option><option value="1">A few users</option></select></div>
        <div class="field"><label for="v-wk">Is there a workaround?</label>
          <select class="input" id="v-wk"><option value="2">No workaround</option><option value="1" selected>Hard to find</option><option value="0">Easy workaround</option></select></div>
        <div class="field"><label for="v-risk">Data loss or security risk?</label>
          <select class="input" id="v-risk"><option value="0" selected>No</option><option value="3">Yes</option></select></div>
        <div class="field"><label for="v-area">Which part of the product?</label>
          <select class="input" id="v-area"><option value="2">Core flow (sign in, checkout)</option><option value="1" selected>Secondary feature</option><option value="0">Cosmetic</option></select></div>
        <div class="result" id="v-out" aria-live="polite"></div>
        <div class="tool-actions"><button type="button" class="btn btn-ghost sm" id="v-use">Use in report writer</button></div>
      </article>

      <article class="tool">
        <h2>JSON formatter</h2>
        <p class="desc">Paste a log or API response to tidy it up and check it’s valid.</p>
        <textarea class="input mono" id="j-in" spellcheck="false" placeholder='{"error":"timeout","code":504}'></textarea>
        <p class="error" id="j-err"></p>
        <div class="tool-actions">
          <button type="button" class="btn btn-primary sm" id="j-fmt">Format</button>
          <button type="button" class="btn btn-ghost sm" id="j-min">Minify</button>
          <button type="button" class="btn btn-ghost sm" id="j-copy">Copy</button>
        </div>
      </article>

      <article class="tool">
        <h2>Export reports</h2>
        <p class="desc" id="x-info"></p>
        <div class="tool-actions">
          <button type="button" class="btn btn-primary sm" id="x-csv">Download CSV</button>
          <button type="button" class="btn btn-ghost sm" id="x-json">Download JSON</button>
        </div>
      </article>

    </div>
  </section>`);

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
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const reports = () => (window.BBuddy ? window.BBuddy.getReports() : []);

  /* ---------- Switch between reports and tools ---------- */
  const toolsBtn = $('tools-btn');
  const reportEls = main.querySelectorAll(':scope > .top, :scope > .stats, :scope > .card');
  function showTools(on) {
    reportEls.forEach((el) => { el.style.display = on ? 'none' : ''; });
    $('tools-view').style.display = on ? '' : 'none';
    toolsBtn.setAttribute('aria-current', String(on));
    if (on) {
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-current', 'false'));
      updateExport();
    }
  }
  toolsBtn.addEventListener('click', () => showTools(true));
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => showTools(false)));

  /* ---------- Device and browser info ---------- */
  function envRows() {
    const ua = navigator.userAgent;
    const name = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Unknown';
    const ver = (ua.match(/(?:Edg|OPR|Firefox|Chrome|Version)\/(\d+)/) || [])[1];
    return [
      ['Browser', name + (ver ? ' ' + ver : '')],
      ['Operating system', (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'Unknown'],
      ['Screen', screen.width + ' × ' + screen.height + ' at ' + (window.devicePixelRatio || 1) + 'x'],
      ['Window', window.innerWidth + ' × ' + window.innerHeight],
      ['Language', navigator.language],
      ['Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone],
      ['Theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'],
      ['Online', navigator.onLine ? 'Yes' : 'No']
    ];
  }
  const envText = () => envRows().map((r) => '- ' + r[0] + ': ' + r[1]).join('\n');
  function drawEnv() {
    const dl = $('e-list');
    dl.replaceChildren();
    envRows().forEach(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    });
  }
  $('e-copy').addEventListener('click', () => copy(envText()));
  drawEnv();

  /* ---------- Bug report writer ---------- */
  function buildReport() {
    const title = $('w-title').value.trim() || 'Untitled bug';
    const steps = $('w-steps').value.split('\n').map((s) => s.trim()).filter(Boolean);
    let md = '## ' + title + '\n**Severity:** ' + SEV[$('w-sev').value] + '\n';
    if (steps.length) md += '\n### Steps to reproduce\n' + steps.map((s, i) => (i + 1) + '. ' + s).join('\n') + '\n';
    if ($('w-exp').value.trim()) md += '\n### Expected result\n' + $('w-exp').value.trim() + '\n';
    if ($('w-act').value.trim()) md += '\n### Actual result\n' + $('w-act').value.trim() + '\n';
    if ($('w-env').checked) md += '\n### Environment\n' + envText() + '\n';
    return md.trim();
  }
  const drawReport = () => { $('w-out').textContent = buildReport(); };
  ['w-title', 'w-sev', 'w-steps', 'w-exp', 'w-act', 'w-env'].forEach((id) => {
    $(id).addEventListener('input', drawReport);
    $(id).addEventListener('change', drawReport);
  });
  $('w-copy').addEventListener('click', () => copy(buildReport()));
  $('w-save').addEventListener('click', () => {
    const title = $('w-title').value.trim();
    $('w-err').textContent = '';
    if (!title) { $('w-err').textContent = 'Enter a title before saving.'; $('w-title').focus(); return; }
    if (!window.BBuddy) { $('w-err').textContent = 'Saving isn’t available. Check the dashboard edit.'; return; }
    window.BBuddy.addReport({
      id: Date.now().toString(36),
      title: title,
      desc: $('w-act').value.trim() || $('w-steps').value.split('\n')[0].trim(),
      severity: $('w-sev').value,
      status: 'open',
      created: new Date().toISOString()
    });
    ['w-title', 'w-steps', 'w-exp', 'w-act'].forEach((id) => { $(id).value = ''; });
    drawReport();
    toast('Saved to your reports');
  });
  drawReport();

  /* ---------- Severity helper ---------- */
  function suggest() {
    const total = ['v-imp', 'v-wk', 'v-risk', 'v-area'].reduce((a, id) => a + Number($(id).value), 0);
    let s = total >= 8 ? 'critical' : total >= 5 ? 'high' : total >= 3 ? 'medium' : 'low';
    if ($('v-risk').value === '3' && (s === 'medium' || s === 'low')) s = 'high';
    return { s, total };
  }
  function drawSev() {
    const { s, total } = suggest();
    const out = $('v-out');
    out.replaceChildren();
    const badge = document.createElement('span');
    badge.className = 'badge sev-' + s; badge.textContent = SEV[s];
    const note = document.createElement('span');
    note.className = 'sub'; note.textContent = 'Score ' + total + ' of 10';
    out.append(badge, note);
  }
  ['v-imp', 'v-wk', 'v-risk', 'v-area'].forEach((id) => $(id).addEventListener('change', drawSev));
  $('v-use').addEventListener('click', () => { $('w-sev').value = suggest().s; drawReport(); toast('Severity set in report writer'); });
  drawSev();

  /* ---------- JSON formatter ---------- */
  function json(indent) {
    const box = $('j-in');
    $('j-err').textContent = '';
    if (!box.value.trim()) { $('j-err').textContent = 'Paste some JSON first.'; return; }
    try { box.value = JSON.stringify(JSON.parse(box.value), null, indent); }
    catch (e) { $('j-err').textContent = 'Not valid JSON: ' + e.message; }
  }
  $('j-fmt').addEventListener('click', () => json(2));
  $('j-min').addEventListener('click', () => json(0));
  $('j-copy').addEventListener('click', () => { if ($('j-in').value) copy($('j-in').value); });

  /* ---------- Export ---------- */
  function updateExport() {
    const n = reports().length;
    $('x-info').textContent = n + (n === 1 ? ' report is' : ' reports are') + ' ready to export.';
  }
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('x-csv').addEventListener('click', () => {
    const rows = reports();
    if (!rows.length) return toast('No reports to export');
    const cols = ['id', 'title', 'desc', 'severity', 'status', 'created'];
    const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\r\n');
    download('bug-reports.csv', csv, 'text/csv');
  });
  $('x-json').addEventListener('click', () => {
    const rows = reports();
    if (!rows.length) return toast('No reports to export');
    download('bug-reports.json', JSON.stringify(rows, null, 2), 'application/json');
  });
})();