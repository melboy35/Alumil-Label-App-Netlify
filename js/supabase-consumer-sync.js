/**
 * Supabase Live Sync - Consumer Implementation
 * Add this to consumer pages: profile-label-printing.html, search-inventory.html, etc.
 */

// INIT SUPABASE (replace with your actual credentials)
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ORG_ID = localStorage.getItem('org_id') || '00000000-0000-0000-0000-000000000000';

/**
 * Fetch live data from Supabase, fallback to local cache
 */
async function fetchLiveData() {
  try {
    console.log('Fetching live data from Supabase...');
    
    // Pull both tables (you can filter columns to what the page needs)
    const [{ data: profiles, error: profilesError }, { data: accessories, error: accessoriesError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('org_id', ORG_ID).limit(10000),
        supabase.from('accessories').select('*').eq('org_id', ORG_ID).limit(10000)
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
    
    // Update local cache to keep your current code working
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
 * Get current dataset versions for change detection
 */
async function getCurrentVersions() {
  try {
    const { data, error } = await supabase
      .from('dataset_versions')
      .select('kind, version, row_count, created_at')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    const versions = {};
    data.forEach(row => {
      if (!versions[row.kind] || row.created_at > versions[row.kind].created_at) {
        versions[row.kind] = row;
      }
    });
    
    return versions;
  } catch (error) {
    console.warn('Failed to fetch versions:', error);
    return {};
  }
}

/**
 * Check if data needs refresh based on versions
 */
async function needsRefresh() {
  try {
    const localCache = JSON.parse(localStorage.getItem('excelCache') || '{}');
    const localVersions = localCache.versions || {};
    const remoteVersions = await getCurrentVersions();
    
    for (const kind of ['profiles', 'accessories']) {
      const localVer = localVersions[kind] || 0;
      const remoteVer = remoteVersions[kind]?.version || 0;
      if (remoteVer > localVer) {
        return true;
      }
    }
    
    return false;
  } catch {
    return true; // Refresh on error
  }
}

/**
 * Setup realtime subscriptions for instant updates
 */
function setupRealtimeSync() {
  // Realtime on table changes
  const channel = supabase.channel('live-sync')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'profiles',
      filter: `org_id=eq.${ORG_ID}`
    }, async () => {
      console.log('Profiles updated, refreshing data...');
      await fetchLiveData();
      if (window.onDataRefresh) window.onDataRefresh('profiles');
    })
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'accessories',
      filter: `org_id=eq.${ORG_ID}`
    }, async () => {
      console.log('Accessories updated, refreshing data...');
      await fetchLiveData();
      if (window.onDataRefresh) window.onDataRefresh('accessories');
    })
    .subscribe();

  // Or: lighter approach – listen to dataset_versions inserts only
  const versionChannel = supabase.channel('version-bumps')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'dataset_versions',
      filter: `org_id=eq.${ORG_ID}`
    }, async (payload) => {
      console.log('Dataset version updated:', payload.new);
      await fetchLiveData();
      if (window.onDataRefresh) window.onDataRefresh(payload.new.kind);
    })
    .subscribe();

  // Return cleanup function
  return () => {
    channel.unsubscribe();
    versionChannel.unsubscribe();
  };
}

/**
 * Initialize live data loading on page load
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

/* 
INTEGRATION INSTRUCTIONS:
========================
1. Add this script to your consumer pages (profile-label-printing.html, etc.)

2. In your page's DOMContentLoaded event, add:

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize live data
  await initializeLiveData();
  
  // Your existing code that reads from localStorage/cache
  // will automatically get the fresh data
  const data = JSON.parse(localStorage.getItem('excelCache') || '{}');
  
  // TODO: your existing render functions
  // e.g., buildSearchIndex(data.profiles, data.accessories);
});

3. Optional: Define a refresh callback:

window.onDataRefresh = function(kind) {
  console.log(`${kind} data refreshed, updating UI...`);
  // Re-run your render functions
  // e.g., rebuildSearchIndex();
};
*/