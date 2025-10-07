// logout-helper.js (idempotent unified logout)
(() => {
  const getSb = () => (window.getSupabaseClient ? window.getSupabaseClient() : window._sbClient);

  if (!window.AuthHelper) window.AuthHelper = {};

  window.AuthHelper.handleLogout = async function handleLogout(opts = {}) {
    const logger = window.alumilLogger;
    const log = (t,p) => { if(logger) logger.log(t,p); else console.log('[logout]', t, p||''); };
    try {
      log('logout_attempt');
      const sb = getSb();
      if (sb?.auth?.signOut) {
        try { await sb.auth.signOut(); log('logout_supabase_ok'); } catch(e){ log('logout_supabase_err',{m:e.message}); }
      }
      // Preserve theme
      let theme=null; try { theme = localStorage.getItem('theme') || localStorage.getItem('alumil:theme'); } catch {}

      // Clear localStorage fully
      try { localStorage.clear(); } catch {}
      if (theme) { try { localStorage.setItem('theme', theme); localStorage.setItem('alumil:theme', theme);} catch{} }

      // IndexedDB cleanup (best-effort)
      try {
        const toDelete = ['DexieDatabase','alumil-cache','inventory-state-db'];
        toDelete.forEach(name => { try { window.indexedDB.deleteDatabase(name); } catch {} });
      } catch {}

      // Service worker caches (optional)
      try {
        if (window.caches?.keys) {
          const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch {}

      await new Promise(r => setTimeout(r, 100));
      const redirectTo = opts.redirectTo || 'login.html';
      log('logout_redirect', { to: redirectTo });
      window.location.replace(redirectTo + '?logged_out=1');
    } catch (err) {
      console.error('Logout failed:', err);
      window.location.reload();
    }
  };

  // Wire button by ID if inline handler removed
  function wire(){
    const btn = document.getElementById('logout-btn');
    if (btn && !btn.__logoutWired) {
      btn.addEventListener('click', e => { e.preventDefault(); window.AuthHelper.handleLogout(); });
      btn.__logoutWired = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
