/**
 * Supabase Live Sync - Single Tenant Consumer (No org_id)
 * Use this version if you get "org_id does not exist" errors
 */

// INIT SUPABASE (replace with your actual credentials)
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Fetch live data for single-tenant (no org_id filter)
 */
async function fetchLiveData() {
  try {
    console.log('Fetching live data from Supabase...');
    
    // Pull both tables without org_id filter
    const [{ data: profiles, error: profilesError }, { data: accessories, error: accessoriesError }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('accessories').select('*')
    ]);
    
    if (profilesError || accessoriesError) {
      throw profilesError || accessoriesError;
    }

    const cache = { 
      profiles: profiles || [], 
      accessories: accessories || [], 
      loadedAt: new Date().toISOString(),
      source: 'live'
    };
    
    // Update local cache
    localStorage.setItem('excelCache', JSON.stringify(cache));
    
    console.log(`Loaded ${cache.profiles.length} profiles and ${cache.accessories.length} accessories from cloud`);
    return cache;
    
  } catch (error) {
    console.warn('Live fetch failed, using local cache:', error);
    
    try {
      const localCache = JSON.parse(localStorage.getItem('excelCache') || '{}');
      localCache.source = 'cache';
      return localCache;
    } catch {
      return { profiles: [], accessories: [], source: 'empty' };
    }
  }
}

/**
 * Check if data needs refresh (simple version)
 */
async function needsRefresh() {
  try {
    const localCache = JSON.parse(localStorage.getItem('excelCache') || '{}');
    const lastLoaded = new Date(localCache.loadedAt || 0);
    const now = new Date();
    const hoursSinceLastLoad = (now - lastLoaded) / (1000 * 60 * 60);
    
    // Refresh if data is older than 1 hour or if source was cache
    return hoursSinceLastLoad > 1 || localCache.source === 'cache';
  } catch {
    return true; // Refresh on error
  }
}

/**
 * Setup realtime subscriptions for single-tenant
 */
function setupRealtimeSync() {
  // Realtime on table changes (no org_id filter)
  const channel = supabase.channel('live-sync')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'profiles'
    }, async () => {
      console.log('Profiles updated, refreshing data...');
      await fetchLiveData();
      if (window.onDataRefresh) window.onDataRefresh('profiles');
    })
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'accessories'
    }, async () => {
      console.log('Accessories updated, refreshing data...');
      await fetchLiveData();
      if (window.onDataRefresh) window.onDataRefresh('accessories');
    })
    .subscribe();

  // Return cleanup function
  return () => {
    channel.unsubscribe();
  };
}

/**
 * Initialize live data loading for single-tenant
 */
async function initializeLiveData() {
  try {
    // Check if we need to refresh
    if (await needsRefresh()) {
      console.log('Data refresh needed, fetching from cloud...');
      await fetchLiveData();
    } else {
      console.log('Local data is current');
    }
    
    // Setup realtime subscriptions
    const cleanup = setupRealtimeSync();
    
    // Store cleanup function for page unload
    window.addEventListener('beforeunload', cleanup);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize live data:', error);
    return false;
  }
}