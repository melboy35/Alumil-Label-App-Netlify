// Auto-sync Excel data from Supabase Storage
// Add this script to pages that need live inventory data (profile-label-printing.html, etc.)

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        BUCKET: 'inventory',
        CACHE_KEY: 'excelCache',
        REFRESH_INTERVAL: 2 * 60 * 1000, // 2 minutes
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000 // 1 second
    };

    // Get Supabase client
    function getSupabaseClient() {
        return window._sbClient || 
               (window.supabase && window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY)) ||
               null;
    }

    // Get current file info from database
    async function getCurrentFileInfo() {
        const sb = getSupabaseClient();
        if (!sb) throw new Error('Supabase client not available');

        try {
            // Try RPC first
            const { data, error } = await sb.rpc('get_current_file_info');
            if (!error && data && data.length > 0) {
                return data[0];
            }
        } catch (e) {
            console.warn('RPC failed, trying direct query:', e);
        }

        // Fallback to direct table query
        const { data, error } = await sb
            .from('inventory_files')
            .select('filename, checksum, uploaded_at')
            .eq('is_current', true)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    // Download file from Supabase Storage
    async function downloadFile(filename, cacheBust) {
        const sb = getSupabaseClient();
        if (!sb) throw new Error('Supabase client not available');

        // Build public URL with cache-busting parameter
        const baseUrl = (window.SUPABASE_URL || '').replace(/\/$/, '');
        const url = `${baseUrl}/storage/v1/object/public/${CONFIG.BUCKET}/${encodeURIComponent(filename)}${cacheBust ? '?v=' + encodeURIComponent(cacheBust) : ''}`;

        const response = await fetch(url, { 
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        return response.arrayBuffer();
    }

    // Parse Excel data using XLSX library
    function parseExcelData(arrayBuffer, filename) {
        // Ensure XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded. Please include the SheetJS library.');
        }

        let workbook;
        
        // Handle different file types
        if (/\.csv$/i.test(filename)) {
            const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
            workbook = XLSX.read(text, { type: 'string' });
        } else {
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
        }

        const sheetNames = workbook.SheetNames;
        
        // Find profile and accessory sheets (flexible naming)
        const profileSheetName = sheetNames.find(name => /profile/i.test(name)) || sheetNames[0];
        const accessorySheetName = sheetNames.find(name => /accessor|acc/i.test(name)) || sheetNames[1] || sheetNames[0];

        // Convert sheets to JSON
        const profiles = profileSheetName ? 
            XLSX.utils.sheet_to_json(workbook.Sheets[profileSheetName], { defval: "" }) : [];
        
        const accessories = accessorySheetName && accessorySheetName !== profileSheetName ? 
            XLSX.utils.sheet_to_json(workbook.Sheets[accessorySheetName], { defval: "" }) : [];

        return { profiles, accessories };
    }

    // Check if local cache is valid
    function isCacheValid(localCache, remoteFileInfo) {
        if (!localCache || !localCache.checksum || !localCache.profiles || !localCache.accessories) {
            return false;
        }

        if (!remoteFileInfo) {
            return true; // No remote info, assume cache is valid
        }

        // Compare checksums or upload dates
        const remoteIdentifier = remoteFileInfo.checksum || remoteFileInfo.uploaded_at;
        if (localCache.checksum !== remoteIdentifier) {
            return false;
        }

        // Check if cache is too old (fallback check)
        const cacheAge = Date.now() - new Date(localCache.loadedAt || 0).getTime();
        const maxAge = 10 * 60 * 1000; // 10 minutes max age
        
        return cacheAge < maxAge;
    }

    // Main function to fetch and cache latest data
    async function fetchAndCache(forceRefresh = false) {
        let attempt = 0;
        
        while (attempt < CONFIG.RETRY_ATTEMPTS) {
            try {
                // Get current file info
                const fileInfo = await getCurrentFileInfo();
                if (!fileInfo || !fileInfo.filename) {
                    console.log('No inventory file found in database');
                    return false;
                }

                // Check local cache
                const localCache = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}');
                
                if (!forceRefresh && isCacheValid(localCache, fileInfo)) {
                    console.log('Using cached Excel data (valid)');
                    return true;
                }

                console.log('Downloading fresh Excel data:', fileInfo.filename);

                // Download file
                const cacheBuster = fileInfo.checksum || fileInfo.uploaded_at;
                const arrayBuffer = await downloadFile(fileInfo.filename, cacheBuster);

                // Parse Excel data
                const parsedData = parseExcelData(arrayBuffer, fileInfo.filename);

                // Update cache
                const cacheData = {
                    ...parsedData,
                    checksum: cacheBuster,
                    fileName: fileInfo.filename,
                    loadedAt: new Date().toISOString(),
                    fileSize: arrayBuffer.byteLength
                };

                localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cacheData));

                console.log(`✅ Downloaded and cached: ${fileInfo.filename} (${parsedData.profiles.length} profiles, ${parsedData.accessories.length} accessories)`);

                // Dispatch event for other parts of the app
                window.dispatchEvent(new CustomEvent('excelCacheUpdated', {
                    detail: cacheData
                }));

                return true;

            } catch (error) {
                attempt++;
                console.warn(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt < CONFIG.RETRY_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
                } else {
                    console.error('Failed to fetch Excel data after all attempts:', error);
                    
                    // Check if we have any cached data as fallback
                    const fallbackCache = localStorage.getItem(CONFIG.CACHE_KEY);
                    if (fallbackCache) {
                        console.log('Using stale cached data as fallback');
                        return true;
                    }
                    
                    throw error;
                }
            }
        }
    }

    // Show sync status in UI (optional)
    function showSyncStatus(message, type = 'info') {
        // Only show if there's a status container
        const statusContainer = document.getElementById('sync-status') || 
                              document.querySelector('.sync-status');
        
        if (!statusContainer) return;

        statusContainer.textContent = message;
        statusContainer.className = `sync-status ${type}`;
        
        // Auto-hide after a few seconds
        setTimeout(() => {
            statusContainer.textContent = '';
            statusContainer.className = 'sync-status';
        }, 3000);
    }

    // Setup periodic refresh
    function setupPeriodicRefresh() {
        setInterval(async () => {
            try {
                const updated = await fetchAndCache();
                if (updated) {
                    showSyncStatus('📄 Data refreshed', 'success');
                }
            } catch (error) {
                console.warn('Periodic refresh failed:', error);
                showSyncStatus('⚠️ Sync failed', 'warning');
            }
        }, CONFIG.REFRESH_INTERVAL);
    }

    // Initialize auto-sync
    async function initialize() {
        const sb = getSupabaseClient();
        if (!sb) {
            console.warn('Supabase client not found. Auto-sync disabled.');
            return;
        }

        try {
            // Initial fetch
            showSyncStatus('📥 Loading data...', 'info');
            await fetchAndCache();
            showSyncStatus('✅ Data loaded', 'success');
            
            // Setup periodic refresh
            setupPeriodicRefresh();
            
            console.log('✅ Excel auto-sync initialized');
            
        } catch (error) {
            console.error('Failed to initialize auto-sync:', error);
            showSyncStatus('❌ Load failed', 'error');
        }
    }

    // Manual refresh function
    async function manualRefresh() {
        try {
            showSyncStatus('🔄 Refreshing...', 'info');
            await fetchAndCache(true);
            showSyncStatus('✅ Refreshed', 'success');
        } catch (error) {
            console.error('Manual refresh failed:', error);
            showSyncStatus('❌ Refresh failed', 'error');
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Export for manual control
    window.ExcelAutoSync = {
        refresh: manualRefresh,
        fetchAndCache,
        initialize
    };

})();