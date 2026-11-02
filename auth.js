(function () {
  const $ = (id) => document.getElementById(id);
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- Validation ---------- */
  function setError(input, message) {
    const err = $(input.id + '-error');
    if (err) err.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !message;
  }

  function checkRequired(input, message) {
    return setError(input, input.value.trim() ? '' : message);
  }

  function checkEmail(input) {
    const v = input.value.trim();
    if (!v) return setError(input, 'Enter your email address.');
    if (!emailPattern.test(v)) return setError(input, 'Enter a valid email, like you@example.com.');
    return setError(input, '');
  }

  function checkPassword(input, message) {
    const v = input.value;
    if (!v) return setError(input, message || 'Enter your password.');
    if (v.length < 8) return setError(input, 'Passwords have at least 8 characters.');
    return setError(input, '');
  }

  function checkConfirm(input, original) {
    if (!input.value) return setError(input, 'Confirm your password.');
    if (input.value !== original.value) return setError(input, 'The passwords don’t match.');
    return setError(input, '');
  }

  /* Re-check a field as the person leaves it, then as they fix it */
  function live(input, check) {
    input.addEventListener('blur', () => { if (input.value) check(); });
    input.addEventListener('input', () => { if (input.hasAttribute('aria-invalid')) check(); });
  }

  /* ---------- Alerts and loading ---------- */
  function showAlert(message, ok) {
    const box = $('form-alert');
    if (!box) return;
    box.textContent = message;
    box.className = 'alert show' + (ok ? ' ok' : '');
  }
  function hideAlert() {
    const box = $('form-alert');
    if (box) box.className = 'alert';
  }
  function setLoading(btn, on, text) {
    const label = btn.querySelector('.label');
    if (on) {
      btn.dataset.label = label.textContent;
      label.textContent = text;
    } else if (btn.dataset.label) {
      label.textContent = btn.dataset.label;
    }
    btn.disabled = on;
    btn.classList.toggle('loading', on);
  }

  /* ---------- Password strength ---------- */
  function strength(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    return Math.max(s, 1);
  }
  function wireMeter(input, meter, text) {
    input.addEventListener('input', () => {
      const s = strength(input.value);
      meter.dataset.level = s;
      text.textContent = s ? ['', 'Weak', 'Fair', 'Good', 'Strong'][s] : '';
    });
  }

  /* ---------- Session and redirect ---------- */
  function signIn(email, name) {
    try {
      sessionStorage.setItem('bbuddy_user', email);
      if (name) sessionStorage.setItem('bbuddy_name', name);
      else sessionStorage.removeItem('bbuddy_name');
    } catch (e) {}
    window.location.href = 'dashboard.html';
  }

  /* ---------- Show/hide password buttons ---------- */
  document.querySelectorAll('.toggle').forEach((btn) => {
    const input = $(btn.dataset.target);
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
      input.focus();
    });
  });

  /* ---------- Continue with Google ---------- */
  const google = $('google');
  if (google) {
    google.addEventListener('click', () => {
      hideAlert();
      setLoading(google, true, 'Connecting to Google…');
      /* DEMO ONLY: this fakes a Google account.
         To make it real, use Google Identity Services (see the notes after the code),
         then call signIn(user.email, user.name) once your server verifies the token. */
      setTimeout(() => signIn('google.user@gmail.com', 'Google User'), 900);
    });
  }

  window.Auth = {
    $, checkRequired, checkEmail, checkPassword, checkConfirm, live,
    showAlert, hideAlert, setLoading, wireMeter, signIn, setError
  };
})();