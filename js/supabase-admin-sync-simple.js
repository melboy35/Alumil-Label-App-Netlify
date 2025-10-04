/**
 * Supabase Live Sync - Single Tenant Version (No org_id)
 * Use this version if you get "org_id does not exist" errors
 */

// INIT SUPABASE (replace with your actual credentials)
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Normalize profiles rows for single-tenant (no org_id)
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
    }
    o.updated_at = new Date().toISOString();
    return o;
  }).filter(x => x.code);
}

/**
 * Normalize accessories rows for single-tenant (no org_id)
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
    }
    o.updated_at = new Date().toISOString();
    return o;
  }).filter(x => x.code);
}

/**
 * Chunked upsert for single-tenant (no org_id)
 */
async function chunkedUpsert(table, rows, chunkSize = 500) {
  const total = rows.length;
  let processed = 0;
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(slice, { onConflict: 'code' }); // Single column conflict for single-tenant
    
    if (error) throw error;
    
    processed += slice.length;
    if (window.updateUploadProgress) {
      window.updateUploadProgress(table, processed, total);
    }
  }
}

/**
 * Simple version tracking for single-tenant
 */
async function recordVersion(kind, count) {
  try {
    // Store version info in localStorage for single-tenant
    const versions = JSON.parse(localStorage.getItem('dataVersions') || '{}');
    versions[kind] = {
      version: (versions[kind]?.version || 0) + 1,
      count: count,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('dataVersions', JSON.stringify(versions));
    
    console.log(`${kind} version updated to ${versions[kind].version}`);
    return versions[kind].version;
  } catch (error) {
    console.warn('Error recording version:', error);
    return 1;
  }
}

/**
 * Main function for single-tenant sync
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

    // Keep local cache
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

    console.log('Single-tenant sync completed successfully');
    return { success: true, profiles: pRows.length, accessories: aRows.length };
    
  } catch (error) {
    console.error('Single-tenant sync failed:', error);
    throw error;
  }
}