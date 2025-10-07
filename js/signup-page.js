// signup-page.js - moved from inline script in signup.html
function getSupabaseClient() {
  if (window._sbClient) {
    return window._sbClient;
  }
  try {
    const url = document.querySelector('meta[name="supabase-url"]').content;
    const key = document.querySelector('meta[name="supabase-key"]').content;
  window._sbClient = supabase.createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true } });
    return window._sbClient;
  } catch (e) { console.error(e); return null; }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signup-form');
  const errorEl = document.getElementById('error-message');
  const successEl = document.getElementById('success-message');
  const btn = document.getElementById('signup-btn');

  function showError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
  function hideError() { errorEl.style.display = 'none'; }
  function showSuccess(msg) { successEl.textContent = msg; successEl.style.display = 'block'; }
  function hideSuccess() { successEl.style.display = 'none'; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); hideError(); hideSuccess();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm_password').value;

    if (!name || !email || !password || !confirm) { showError('Please complete all fields'); return; }
    if (password.length < 8) { showError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { showError('Passwords do not match'); return; }

  btn.disabled = true; btn.textContent = 'Signing up...';
  if (window.alumilLogger) window.alumilLogger.log('signup_attempt', { email, name });

    const supabase = getSupabaseClient();
    if (!supabase) { showError('Service unavailable'); btn.disabled = false; btn.textContent = 'Sign Up'; return; }

    try {
      // Use Supabase auth signUp which triggers email verification by default
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      }, {
        data: { full_name: name }
      });

      if (error) {
        console.warn('Sign up error:', error);
        if (window.alumilLogger) window.alumilLogger.log('signup_error', { error: error.message || error });
        // If insertion into auth failed, fallback to previous behavior (mailto)
        window.location.href = 'mailto:it-support@alumil.com?subject=Signup failed for ' + encodeURIComponent(name) + '&body=Please create an account for:%0AName:%20' + encodeURIComponent(name) + '%0AEmail:%20' + encodeURIComponent(email);
        return;
      }

      // Supabase returns user or session info but we mainly need to inform the user to check email
      if (window.alumilLogger) window.alumilLogger.log('signup_success', { email });
      showSuccess('Check your inbox: a verification email has been sent to ' + email + '. Follow the link to activate your account.');
      form.reset();
    } catch (err) {
      console.error(err);
      showError('Sign up failed. Please try again or contact it-support@alumil.com');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign Up';
    }
  });
});
