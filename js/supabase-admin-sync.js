/**
 * Fetch all profiles and accessories for admin display (removes 1000-row limit)
 */
async function fetchAllAdminData() {
  try {
    const [{ data: profiles, error: profilesError }, { data: accessories, error: accessoriesError }] = await Promise.all([
      supabase.from('profiles').select('*').eq('org_id', ORG_ID).limit(10000),
      supabase.from('accessories').select('*').eq('org_id', ORG_ID).limit(10000)
    ]);
    if (profilesError || accessoriesError) {
      throw profilesError || accessoriesError;
    }
    return { profiles: profiles || [], accessories: accessories || [] };
  } catch (error) {
    console.error('Admin fetch failed:', error);
    return { profiles: [], accessories: [] };
  }
}
/**
 * Supabase Live Sync - Admin Implementation
 * Add this to your admin.html file for real-time data synchronization
 */

// INIT SUPABASE (replace with your actual credentials)
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Resolve org_id from your auth or a fixed value for single-tenant
const ORG_ID = localStorage.getItem('org_id') || '00000000-0000-0000-0000-000000000000';

/**
 * Normalize profiles rows: map flexible column names to schema keys
 */
function normalizeProfiles(rows) {
  const mapKey = (k) => (k || '').toLowerCase().trim();
  return rows.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r || {})) {
      const mk = mapKey(k);
      if (['code','item code','profile code'].includes(mk)) o.code = String(v || '').trim();
      else if (['desc','description','name'].includes(mk)) o.description = String(v ?? '');
      else if (['length','len'].includes(mk)) o.length = Number(v) || null;
      else if (['colour','color'].includes(mk)) o.color = String(v ?? '');
      // add any additional mappings as needed
    }
    o.org_id = ORG_ID;
    o.updated_at = new Date().toISOString();
    return o;
  }).filter(x => x.code);
}

/**
 * Normalize accessories rows: map flexible column names to schema keys
 */
function normalizeAccessories(rows) {
  const mapKey = (k) => (k || '').toLowerCase().trim();
  return rows.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r || {})) {
      const mk = mapKey(k);
      if (['code','item code','accessory code','acc code'].includes(mk)) o.code = String(v || '').trim();
      else if (['desc','description','name'].includes(mk)) o.description = String(v ?? '');
      else if (['unit','uom'].includes(mk)) o.unit = String(v ?? '');
      // add more mappings as needed
    }
    o.org_id = ORG_ID;
    o.updated_at = new Date().toISOString();
    return o;
  }).filter(x => x.code);
}

/**
 * Chunked upsert to avoid payload limits
 */
async function chunkedUpsert(table, rows, chunkSize = 500) {
  const total = rows.length;
  let processed = 0;
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(slice, { onConflict: 'org_id,code' });
    
    if (error) throw error;
    
    processed += slice.length;
    
    // Update progress if UI exists
    if (window.updateUploadProgress) {
      window.updateUploadProgress(table, processed, total);
    }
  }
}

/**
 * Write a new version row so other clients can detect updates
 */
async function recordVersion(kind, count) {
  const { data: prev, error: prevErr } = await supabase
    .from('dataset_versions')
    .select('version')
    .eq('org_id', ORG_ID)
    .eq('kind', kind)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (prevErr) console.warn('Error fetching previous version:', prevErr);
  
  const nextVer = (prev?.version || 0) + 1;
  const { error } = await supabase.from('dataset_versions').insert([{
    org_id: ORG_ID,
    kind, 
    version: nextVer, 
    row_count: count
  }]);
  
  if (error) console.warn('Error recording version:', error);
  
  return nextVer;
}

/**
 * Main function to make data live - call this after Excel parsing
 */
async function makeLive(profilesRows, accessoriesRows) {
  try {
    const pRows = normalizeProfiles(profilesRows);
    const aRows = normalizeAccessories(accessoriesRows);

    console.log(`Syncing ${pRows.length} profiles and ${aRows.length} accessories to cloud...`);

    // Upsert to cloud
    await chunkedUpsert('profiles', pRows);
    const profileVersion = await recordVersion('profiles', pRows.length);

    await chunkedUpsert('accessories', aRows);
    const accessoryVersion = await recordVersion('accessories', aRows.length);

    // Keep local cache for offline (unchanged from your current behavior)
    localStorage.setItem('excelCache', JSON.stringify({
      profiles: pRows, 
      accessories: aRows,
      fileName: 'Live dataset', 
      loadedAt: new Date().toISOString(),
      versions: {
        profiles: profileVersion,
        accessories: accessoryVersion
      }
    }));

    console.log('Live sync completed successfully');
    return { success: true, profiles: pRows.length, accessories: aRows.length };
    
  } catch (error) {
    console.error('Live sync failed:', error);
    throw error;
  }
}

/**
 * Optional: Progress UI updater
 */
window.updateUploadProgress = function(table, processed, total) {
  const percent = Math.round((processed / total) * 100);
  console.log(`${table}: ${processed}/${total} (${percent}%)`);
  
  // Update UI if progress elements exist
  const progressEl = document.getElementById(`${table}-progress`);
  if (progressEl) {
    progressEl.style.width = `${percent}%`;
    progressEl.textContent = `${percent}%`;
  }
};

/* 
INTEGRATION INSTRUCTIONS:
========================
In your current admin.html, after you build `profiles` and `accessories` arrays 
from your Excel parsing, add this call:

try {
  await makeLive(profiles, accessories);
  // Show success message
  showMessage('Data uploaded and synced to all devices!');
} catch (error) {
  console.error('Sync failed:', error);
  showMessage('Upload completed locally, but cloud sync failed. Data saved offline.');
}
*/