(function () {
  const grid = document.querySelector('#tools-view .tools-grid');
  if (!grid) return;
  const $ = (id) => document.getElementById(id);
  const FENCE = '\u0060\u0060\u0060';

  /* ---------- Markup ---------- */
  grid.insertAdjacentHTML('beforeend', `
    <article class="tool">
      <h2>Colour contrast checker</h2>
      <p class="desc">Check whether text is readable against its background (WCAG accessibility rules).</p>
      <div class="field"><label for="c-fgt">Text colour</label>
        <div class="colorrow"><input type="color" class="swatch" id="c-fg" value="#111111" aria-label="Pick text colour"><input class="input" id="c-fgt" value="#111111" maxlength="7" spellcheck="false"></div></div>
      <div class="field"><label for="c-bgt">Background colour</label>
        <div class="colorrow"><input type="color" class="swatch" id="c-bg" value="#ffffff" aria-label="Pick background colour"><input class="input" id="c-bgt" value="#ffffff" maxlength="7" spellcheck="false"></div></div>
      <p class="error" id="c-err"></p>
      <div class="preview" id="c-prev"><span id="c-p1">Sample text at normal size</span><strong id="c-p2" style="font-size:1.5rem">Large sample text</strong></div>
      <div class="big" id="c-ratio" aria-live="polite"></div>
      <ul class="checks" id="c-list"></ul>
      <div class="tool-actions">
        <button type="button" class="btn btn-ghost sm" id="c-swap">Swap colours</button>
        <button type="button" class="btn btn-primary sm" id="c-add">Add to report writer</button>
      </div>
    </article>

    <article class="tool wide">
      <h2>Base64 and URL encoder</h2>
      <p class="desc">Encode or decode text found in links, headers and API payloads. Base64 is not encryption, so anyone can decode it.</p>
      <div class="eq">
        <div class="field"><label for="k-in">Input</label><textarea class="input mono" id="k-in" spellcheck="false" placeholder="Paste text here"></textarea></div>
        <div class="field"><label for="k-out">Output</label><textarea class="input mono" id="k-out" readonly spellcheck="false"></textarea></div>
      </div>
      <p class="error" id="k-err"></p>
      <div class="tool-actions">
        <button type="button" class="btn btn-primary sm" id="k-be">Base64 encode</button>
        <button type="button" class="btn btn-primary sm" id="k-bd">Base64 decode</button>
        <button type="button" class="btn btn-primary sm" id="k-ue">URL encode</button>
        <button type="button" class="btn btn-primary sm" id="k-ud">URL decode</button>
        <button type="button" class="btn btn-ghost sm" id="k-swap">Use output as input</button>
        <button type="button" class="btn btn-ghost sm" id="k-copy">Copy output</button>
      </div>
    </article>

    <article class="tool wide">
      <h2>Regex tester</h2>
      <p class="desc">Try a regular expression against sample text. Matches are highlighted as you type.</p>
      <div class="two">
        <div class="field"><label for="r-pat">Pattern</label><input class="input mono" id="r-pat" spellcheck="false" placeholder="(\\w+)@(\\w+)\\.com" style="min-height:0"></div>
        <div class="field"><label for="r-flags">Flags</label><input class="input mono" id="r-flags" value="i" maxlength="8" spellcheck="false" style="min-height:0"></div>
      </div>
      <div class="field"><label for="r-text">Text to test</label><textarea class="input mono" id="r-text" spellcheck="false" placeholder="Paste a log line or sample text"></textarea></div>
      <p class="error" id="r-err"></p>
      <pre class="out" id="r-hl" hidden aria-label="Text with matches highlighted"></pre>
      <p class="stat-line" id="r-stat" aria-live="polite"></p>
      <ul class="matches" id="r-list"></ul>
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

  /* ---------- Colour contrast checker ---------- */
  function hexToRgb(h) {
    h = h.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const toHex = (rgb) => '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
  function lum(rgb) {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  let lastRatio = null;

  function drawContrast() {
    const list = $('c-list');
    list.replaceChildren();
    $('c-err').textContent = '';
    const fg = hexToRgb($('c-fgt').value);
    const bg = hexToRgb($('c-bgt').value);
    if (!fg || !bg) {
      lastRatio = null;
      $('c-ratio').textContent = '';
      $('c-err').textContent = 'Enter colours as hex, like #1a1a1a or #fff.';
      return;
    }
    $('c-fg').value = toHex(fg);
    $('c-bg').value = toHex(bg);
    const prev = $('c-prev');
    prev.style.background = toHex(bg);
    prev.style.color = toHex(fg);

    const l1 = lum(fg), l2 = lum(bg);
    const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    lastRatio = r;
    /* Cut off, don't round, so 4.499 never shows as a passing 4.50 */
    $('c-ratio').textContent = (Math.floor(r * 100) / 100).toFixed(2) + ':1';

    [['Normal text, AA (4.5:1)', 4.5], ['Large text, AA (3:1)', 3], ['Normal text, AAA (7:1)', 7], ['Large text, AAA (4.5:1)', 4.5]].forEach(([label, min]) => {
      const li = document.createElement('li');
      const name = document.createElement('span'); name.textContent = label;
      const pf = document.createElement('span');
      const ok = r >= min;
      pf.className = 'pf ' + (ok ? 'pass' : 'fail');
      pf.textContent = ok ? 'Pass' : 'Fail';
      li.append(name, pf);
      list.append(li);
    });
  }
  [['c-fg', 'c-fgt'], ['c-bg', 'c-bgt']].forEach(([pick, text]) => {
    $(pick).addEventListener('input', () => { $(text).value = $(pick).value; drawContrast(); });
    $(text).addEventListener('input', drawContrast);
  });
  $('c-swap').addEventListener('click', () => {
    const a = $('c-fgt').value;
    $('c-fgt').value = $('c-bgt').value;
    $('c-bgt').value = a;
    drawContrast();
  });
  $('c-add').addEventListener('click', () => {
    if (lastRatio === null) return toast('Enter two valid colours first');
    const r = (Math.floor(lastRatio * 100) / 100).toFixed(2);
    const line = 'Text colour ' + $('c-fgt').value.trim() + ' on background ' + $('c-bgt').value.trim() +
      ' has a contrast ratio of ' + r + ':1 (WCAG AA needs 4.5:1 for normal text).';
    const act = $('w-act');
    if (!act) return toast('Report writer not found');
    act.value = (act.value.trim() ? act.value.trim() + '\n\n' : '') + line;
    fire(act);
    toast('Added to the report writer');
  });
  drawContrast();

  /* ---------- Base64 and URL encoder ---------- */
  function b64enc(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  }
  function b64dec(s) {
    let clean = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) clean += '=';
    let bin;
    try { bin = atob(clean); } catch (e) { throw new Error('That isn’t valid Base64.'); }
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { throw new Error('That decoded to data that isn’t readable text, such as an image or file.'); }
  }
  function urlenc(s) {
    try { return encodeURIComponent(s); } catch (e) { throw new Error('Couldn’t encode that text.'); }
  }
  function urldec(s) {
    try { return decodeURIComponent(s.replace(/\+/g, ' ')); }
    catch (e) { throw new Error('That isn’t valid URL-encoded text.'); }
  }
  function run(fn) {
    const v = $('k-in').value;
    $('k-err').textContent = '';
    if (!v) { $('k-err').textContent = 'Enter some text first.'; return; }
    try { $('k-out').value = fn(v); }
    catch (e) { $('k-out').value = ''; $('k-err').textContent = e.message; }
  }
  $('k-be').addEventListener('click', () => run(b64enc));
  $('k-bd').addEventListener('click', () => run(b64dec));
  $('k-ue').addEventListener('click', () => run(urlenc));
  $('k-ud').addEventListener('click', () => run(urldec));
  $('k-swap').addEventListener('click', () => {
    if (!$('k-out').value) return toast('Nothing to move yet');
    $('k-in').value = $('k-out').value;
    $('k-out').value = '';
    $('k-err').textContent = '';
  });
  $('k-copy').addEventListener('click', () => { if ($('k-out').value) copy($('k-out').value); else toast('Nothing to copy yet'); });

  /* ---------- Regex tester ---------- */
  const MAX_TEXT = 20000;
  const MAX_MATCHES = 500;

  function drawRegex() {
    const list = $('r-list'), hl = $('r-hl');
    list.replaceChildren(); hl.replaceChildren(); hl.hidden = true;
    $('r-err').textContent = ''; $('r-stat').textContent = '';

    const pat = $('r-pat').value;
    if (!pat) return;
    const flags = Array.from(new Set(('g' + $('r-flags').value).replace(/[^dgimsuvy]/g, ''))).join('');
    let re;
    try { re = new RegExp(pat, flags); }
    catch (e) { $('r-err').textContent = 'Invalid pattern: ' + e.message; return; }

    let text = $('r-text').value;
    let note = '';
    if (text.length > MAX_TEXT) { text = text.slice(0, MAX_TEXT); note = ' Only the first 20,000 characters were tested.'; }
    if (!text) { $('r-stat').textContent = 'Add some text to test against.'; return; }

    const found = [];
    for (const m of text.matchAll(re)) { found.push(m); if (found.length >= MAX_MATCHES) break; }

    hl.hidden = false;
    let pos = 0;
    found.forEach((m) => {
      if (!m[0].length) return;
      if (m.index > pos) hl.append(text.slice(pos, m.index));
      const mk = document.createElement('mark');
      mk.textContent = m[0];
      hl.append(mk);
      pos = m.index + m[0].length;
    });
    if (pos < text.length) hl.append(text.slice(pos));

    $('r-stat').textContent = found.length + (found.length === 1 ? ' match' : ' matches') +
      (found.length >= MAX_MATCHES ? ' (showing the first ' + MAX_MATCHES + ')' : '') + '.' + note;

    found.slice(0, 10).forEach((m, i) => {
      const li = document.createElement('li'); li.className = 'match';
      const left = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = 'Match ' + (i + 1) + ': ' + (m[0] || '(empty match)');
      const sub = document.createElement('div'); sub.className = 'sub';
      const groups = m.slice(1).map((g, n) => 'Group ' + (n + 1) + ': ' + (g === undefined ? '(no match)' : g));
      sub.textContent = ['Position ' + m.index].concat(groups).join(' · ');
      left.append(strong, sub);
      li.append(left);
      list.append(li);
    });
  }
  ['r-pat', 'r-flags', 'r-text'].forEach((id) => $(id).addEventListener('input', drawRegex));
})();