// search-inventory-live.js
// Bridges AlumilDataService (Supabase) to the search-inventory page UI
(function(){
  async function initLiveHook(){
    try {
      if (!window.setLiveInventory) { return; }
      // Ensure Supabase client exists
      let client = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : window._sbClient;
      if (!client) { console.warn('search-inventory-live: Supabase client not ready'); return; }
      // Initialize data service if not already
      if (!window.alumilData) {
        if (window.AlumilDataService){
          window.alumilData = new window.AlumilDataService(client);
          await window.alumilData.init();
        } else {
          console.warn('AlumilDataService not available');
          return;
        }
      }
      // Pull current cached (already loaded by init) data
      const profiles = await window.alumilData.getProfiles();
      const accessories = await window.alumilData.getAccessories();
      window.setLiveInventory(profiles, accessories, Date.now());
      // Listen for future updates via custom event
      window.addEventListener('alumilDataLoaded', async () => {
        try {
          const p = await window.alumilData.getProfiles();
          const a = await window.alumilData.getAccessories();
          window.setLiveInventory(p, a, Date.now());
        } catch(e){ console.error('Failed to refresh live inventory after event', e); }
      });
      console.log('✅ search-inventory-live: live hook initialized');
    } catch (e) { console.error('search-inventory-live init error', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLiveHook); else initLiveHook();
})();
