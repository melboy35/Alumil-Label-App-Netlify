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
    const company = document.getElementById('company').value.trim();

    if (!name || !email) { showError('Please provide your name and email'); return; }

    btn.disabled = true; btn.textContent = 'Requesting...';

    const supabase = getSupabaseClient();
    if (!supabase) { showError('Service unavailable'); btn.disabled = false; btn.textContent = 'Request Access'; return; }

    try {
      // Try to insert into an 'access_requests' table (if exists)
      const { error } = await supabase.from('access_requests').insert([{ name, email, company, status: 'pending' }]);
      if (error) {
        // Fallback: open mailto if table doesn't exist or insertion failed
        console.warn('Insert error, falling back to mailto:', error);
        window.location.href = 'mailto:it-support@alumil.com?subject=Access request from ' + encodeURIComponent(name) + '&body=Name:%20' + encodeURIComponent(name) + '%0AEmail:%20' + encodeURIComponent(email) + '%0ACompany:%20' + encodeURIComponent(company);
        return;
      }

      showSuccess('Request submitted. IT will contact you shortly.');
      form.reset();
    } catch (err) {
      console.error(err);
      showError('Failed to submit request. You can email it-support@alumil.com');
    } finally {
      btn.disabled = false; btn.textContent = 'Request Access';
    }
  });
});
