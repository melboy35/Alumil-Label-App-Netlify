// logout-helper.js
// Provides a resilient logout that clears Supabase session and local storage
(function(){
  async function performLogout(options = {}) {
    const redirect = options.redirect || 'login.html';
    const logger = window.alumilLogger;
    function log(type, payload){ if(logger) logger.log(type, payload); else console.log('[logout]', type, payload||''); }
    try {
      log('logout_attempt');
      // Clear using Supabase client if available
      const client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : window._sbClient;
      if (client && client.auth && client.auth.signOut) {
        try {
          // First clear local scope then global (defensive)
          await client.auth.signOut({ scope: 'local' }).catch(()=>{});
          await client.auth.signOut().catch(()=>{});
          log('logout_supabase_done');
        } catch (e) {
          log('logout_supabase_error', { message: e.message });
        }
      }
      // Clear known storage keys
      try {
        localStorage.removeItem('alumil_auth_token');
        // Remove any Supabase v2 persisted keys pattern
        Object.keys(localStorage).forEach(k => { if(k.includes('supabase') || k.includes('sb-')) localStorage.removeItem(k); });
      } catch(e){ log('logout_storage_error', { message: e.message }); }
      // Small delay to allow network call flush
      setTimeout(()=>{ window.location.replace(redirect + '?logged_out=1&ts=' + Date.now()); }, 50);
    } catch (err) {
      log('logout_fatal_error', { message: err.message });
      window.location.replace(redirect + '?logged_out=1&err=1&ts=' + Date.now());
    }
  }

  // Expose
  window.forceLogout = performLogout;

  // Attach to existing logout button(s) if present
  function wireButtons(){
    const btns = [
      document.getElementById('logout-btn'),
      document.getElementById('logoutButton'),
      document.getElementById('mobile-logout-btn')
    ].filter(Boolean);
    btns.forEach(btn => {
      if(!btn.__logoutWired){
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          performLogout();
        });
        btn.__logoutWired = true;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButtons);
  } else {
    wireButtons();
  }
})();
