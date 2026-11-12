(function () {
  const grid = document.querySelector('#tools-view .tools-grid');
  if (!grid) return;
  const $ = (id) => document.getElementById(id);
  const ENDPOINT = '/.netlify/functions/write-with-ai';
  const CODE_KEY = 'bbuddy_ai_code';
  const MAX = 4000;
  const WAIT = 3000;
  const SENSITIVE = /[\w.+-]+@[\w-]+\.[\w.-]+|\bBearer\s+\S+|\b[A-Za-z0-9_-]{32,}\b|\bpassword\s*[:=]\s*\S+/i;
  const SEVS = ['critical', 'high', 'medium', 'low'];
  const TASKS = {
    bug: {
      label: 'Write a bug report from rough notes',
      hint: 'Describe what you saw in your own words. Messy notes are fine.',
      ph: 'Tapped Pay now on iPhone Safari and nothing happened, no error. Works fine on Chrome. Started after yesterday’s update.',
      report: true
    },
    improve: {
      label: 'Improve a report I already wrote',
      hint: 'Paste your report. The facts stay the same, and the wording and structure get cleaned up.',
      ph: 'login broken. i enter pass and it says error. happens a lot. please fix',
      report: true
    },
    cases: {
      label: 'Write test cases for a requirement',
      hint: 'Paste the requirement or user story. You get positive, negative and boundary cases.',
      ph: 'Users can reset their password with a 6-digit code that expires after 10 minutes.',
      report: false
    },
    notes: {
      label: 'Write release notes from fixed bugs',
      hint: 'List the bugs you fixed, one per line, or use the button to load your resolved bugs.',
      ph: '- Checkout button works again on Safari\n- Profile photos over 5 MB now upload',
      report: false
    }
  };

  /* Hidden elements must stay hidden even when a class sets display */
  const css = document.createElement('style');
  css.textContent = '#ai-card [hidden]{display:none!important}';
  document.head.append(css);

  grid.insertAdjacentHTML('afterbegin', `
  <article class="tool wide" id="ai-card">
    <h2>Write with AI</h2>
    <p class="desc">Turn rough notes into a clear draft. AI can get details wrong, so check the result before you use it.</p>
    <div class="eq">
      <div class="field"><label for="ai-task">What do you need?</label><select class="input" id="ai-task"></select></div>
      <div class="field"><label for="ai-ctx">Context (optional)</label><input class="input" id="ai-ctx" maxlength="200" placeholder="Web app, Chrome on Windows"></div>
    </div>
    <div class="field">
      <label for="ai-in">Your notes</label>
      <textarea class="input" id="ai-in" rows="6" maxlength="${MAX}" aria-describedby="ai-hint"></textarea>
      <p class="stat-line" id="ai-hint"></p>
    </div>
    <div class="tool-actions"><button type="button" class="btn btn-ghost sm" id="ai-resolved" hidden>Use my resolved bugs</button></div>
    <div class="field" id="ai-code-row" hidden>
      <label for="ai-code">Access code</label>
      <input class="input" id="ai-code" type="password" autocomplete="off">
    </div>
    <p class="error" id="ai-err" role="alert"></p>
    <div class="tool-actions">
      <button type="button" class="btn btn-primary sm" id="ai-go">Write with AI</button>
      <button type="button" class="btn btn-ghost sm" id="ai-stop" hidden>Stop</button>
      <button type="button" class="btn btn-ghost sm" id="ai-local">Quick draft (no AI)</button>
    </div>
    <div id="ai-result" hidden>
      <div class="field"><label for="ai-out">Draft (you can edit it)</label><textarea class="input mono" id="ai-out" rows="14"></textarea></div>
      <p class="stat-line" id="ai-note" role="status"></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-primary sm" id="ai-copy">Copy as Markdown</button>
        <button type="button" class="btn btn-ghost sm" id="ai-send" hidden>Send to report writer</button>
        <button type="button" class="btn btn-ghost sm" id="ai-save" hidden>Save as bug report</button>
      </div>
    </div>
  </article>`);

  /* ---------- Helpers ---------- */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.remove(), 2000);
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
  const err = (m) => { $('ai-err').textContent = m || ''; };
  const store = {
    get() { try { return sessionStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } },
    set(v) { try { sessionStorage.setItem(CODE_KEY, v); } catch (e) {} }
  };

  /* Reads the title, severity and sections back out of the Markdown, so edits you make still count */
  function parseReport(md) {
    const title = ((md.match(/^##\s+(.+)$/m) || [])[1] || '').trim();
    const raw = ((md.match(/\*\*Severity:\*\*\s*([A-Za-z]+)/i) || [])[1] || '').toLowerCase();
    const sec = (name) => {
      const m = md.match(new RegExp('###\\s+' + name + '[^\\n]*\\n([\\s\\S]*?)(?=\\n###\\s|$)', 'i'));
      return m ? m[1].trim() : '';
    };
    const clean = (s) => (/^not provided\.?$/i.test(s) ? '' : s);
    return {
      title,
      sev: SEVS.indexOf(raw) !== -1 ? raw : 'medium',
      steps: clean(sec('Steps to reproduce')).split('\n').map((l) => l.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim()).filter(Boolean).join('\n'),
      exp: clean(sec('Expected result')),
      act: clean(sec('Actual result'))
    };
  }

  /* ---------- Task picker ---------- */
  const sel = $('ai-task');
  Object.keys(TASKS).forEach((k) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = TASKS[k].label;
    sel.append(o);
  });
  function drawTask() {
    const t = TASKS[sel.value];
    $('ai-in').placeholder = t.ph;
    $('ai-resolved').hidden = sel.value !== 'notes';
    drawCount();
  }
  function drawCount() {
    $('ai-hint').textContent = TASKS[sel.value].hint + ' (' + $('ai-in').value.length + ' of ' + MAX + ' characters)';
  }
  sel.addEventListener('change', drawTask);
  $('ai-in').addEventListener('input', drawCount);
  $('ai-resolved').addEventListener('click', () => {
    const list = window.BBuddy ? window.BBuddy.getReports().filter((r) => r.status === 'resolved') : [];
    if (!list.length) return toast('You have no resolved bugs yet');
    $('ai-in').value = list.map((r) => '- ' + r.title).join('\n').slice(0, MAX);
    drawCount();
  });

  /* ---------- Showing a result ---------- */
  let resultTask = 'bug';
  function showResult(md, note, task) {
    resultTask = task;
    $('ai-out').value = md;
    $('ai-note').textContent = note;
    $('ai-result').hidden = false;
    const isReport = TASKS[task].report;
    $('ai-send').hidden = !(isReport && $('w-title'));
    $('ai-save').hidden = !(isReport && window.BBuddy && window.BBuddy.addReport);
    $('ai-out').scrollIntoView({ block: 'nearest' });
  }

  /* ---------- Quick draft without AI ---------- */
  $('ai-local').addEventListener('click', () => {
    err('');
    const text = $('ai-in').value.trim(), task = sel.value;
    if (!text) return err('Write or paste some notes first.');
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    let md;
    if (TASKS[task].report) {
      const steps = lines.slice(1).map((s) => s.replace(/^\d+[.)]\s*/, ''));
      md = '## ' + lines[0].replace(/^#+\s*/, '').slice(0, 100) + '\n**Severity:** Medium\n\n### Steps to reproduce\n' +
        (steps.length ? steps.map((s, i) => (i + 1) + '. ' + s).join('\n') : '1. Not provided') +
        '\n\n### Expected result\nNot provided\n\n### Actual result\nNot provided';
    } else if (task === 'notes') {
      md = '## Release notes\n\n### Fixed\n' + lines.map((l) => '- ' + l.replace(/^[-*]\s*/, '')).join('\n');
    } else {
      return err('Quick draft works for bug reports and release notes. Test cases need AI.');
    }
    showResult(md, 'Quick draft made without AI. Fill in the parts marked Not provided yourself.', task);
  });

  /* ---------- Asking the AI ---------- */
  let ctl = null, next = 0;
  function busy(on) {
    $('ai-go').disabled = on;
    $('ai-go').textContent = on ? 'Writing…' : 'Write with AI';
    $('ai-stop').hidden = !on;
    $('ai-local').disabled = on;
  }
  $('ai-stop').addEventListener('click', () => { if (ctl) ctl.abort(); });

  async function generate() {
    err('');
    const task = sel.value, text = $('ai-in').value.trim(), context = $('ai-ctx').value.trim();
    if (!text) return err('Write or paste some notes first.');
    if (Date.now() < next) return err('Wait a few seconds before trying again.');
    if (SENSITIVE.test(text + ' ' + context) &&
        !confirm('Your text looks like it contains an email address, password or token. It will be sent to an AI service. Send anyway?')) return;

    busy(true);
    ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, 45000);
    const headers = { 'Content-Type': 'application/json' };
    const code = $('ai-code').value.trim() || store.get();
    if (code) headers['x-access-code'] = code;

    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ task, text, context }), signal: ctl.signal });
      let data = null;
      try { data = await res.json(); } catch (e) {}
      if (res.status === 401) {
        $('ai-code-row').hidden = false;
        $('ai-code').focus();
        return err((data && data.error) || 'Enter the access code to use Write with AI.');
      }
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        return err('AI isn’t connected yet. It needs the server file from the setup steps, and it only runs on your deployed site or with netlify dev. Quick draft still works.');
      }
      if (!res.ok || !data || !data.text) {
        return err((data && data.error) || 'The AI service had a problem (' + res.status + '). Try again.');
      }
      if (code) store.set(code);
      showResult(data.text, 'AI draft. Check every step and detail against what really happened before you use it.', task);
    } catch (e) {
      err(timedOut ? 'That took too long. Try again with shorter notes.'
        : e.name === 'AbortError' ? 'Stopped.'
        : 'Couldn’t reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
      busy(false);
      next = Date.now() + WAIT;
    }
  }
  $('ai-go').addEventListener('click', generate);

  /* ---------- Using the result ---------- */
  $('ai-copy').addEventListener('click', () => { if ($('ai-out').value.trim()) copy($('ai-out').value); else toast('Nothing to copy yet'); });

  $('ai-send').addEventListener('click', () => {
    const p = parseReport($('ai-out').value);
    if (!$('w-title')) return toast('Report writer not found');
    [['w-title', p.title], ['w-sev', p.sev], ['w-steps', p.steps], ['w-exp', p.exp], ['w-act', p.act]].forEach(([id, v]) => {
      if ($(id)) { $(id).value = v; fire($(id)); }
    });
    $('w-title').scrollIntoView({ block: 'center' });
    $('w-title').focus();
    toast('Sent to the report writer');
  });

  $('ai-save').addEventListener('click', () => {
    const p = parseReport($('ai-out').value);
    if (!p.title) return err('The draft needs a title line starting with ##.');
    if (!window.BBuddy || !window.BBuddy.addReport) return err('Saving isn’t available. Check the dashboard setup.');
    err('');
    window.BBuddy.addReport({
      id: Date.now().toString(36),
      title: p.title.slice(0, 120),
      desc: (p.act || p.steps.split('\n')[0] || '').slice(0, 300),
      severity: p.sev,
      status: 'open',
      created: new Date().toISOString()
    });
    toast('Saved to your bug reports');
  });

  drawTask();
})();