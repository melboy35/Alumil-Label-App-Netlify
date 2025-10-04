// Supabase Excel Upload Integration
// Add this script to your admin.html page

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        BUCKET: 'inventory',
        USE_TIMESTAMP_PREFIX: true, // Prefix files with timestamp to avoid overwrites
        AUTO_REFRESH_INTERVAL: 2 * 60 * 1000, // 2 minutes
        CACHE_KEY: 'excelCache'
    };

    // Get Supabase client
    function getSupabaseClient() {
        // Try multiple ways to get the Supabase client
        const client = window._sbClient || 
                      window._supabaseClient ||
                      window.supabaseClient ||
                      (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY && 
                       window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY)) ||
                      null;
        
        console.log('Supabase client check:', {
            _sbClient: !!window._sbClient,
            _supabaseClient: !!window._supabaseClient,
            supabaseClient: !!window.supabaseClient,
            supabaseGlobal: !!window.supabase,
            SUPABASE_URL: !!window.SUPABASE_URL,
            SUPABASE_KEY: !!window.SUPABASE_KEY,
            finalClient: !!client
        });
        
        return client;
    }

    // Utility: Compute SHA-256 hex hash for cache-busting
    async function computeChecksum(arrayBuffer) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Show status message in UI
    function showStatus(message, type = 'info') {
        let statusEl = document.getElementById('supabase-upload-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'supabase-upload-status';
            statusEl.style.cssText = `
                margin: 10px 0;
                padding: 10px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
            `;
            
            // Try to find a good place to insert the status
            const uploadArea = document.getElementById('excel-input')?.parentNode ||
                             document.querySelector('.upload-area') ||
                             document.body;
            uploadArea.appendChild(statusEl);
        }

        // Set styling based on type
        const styles = {
            info: { background: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb' },
            success: { background: '#e8f5e8', color: '#2e7d2e', border: '1px solid #c8e6c9' },
            error: { background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2' },
            warning: { background: '#fff3e0', color: '#f57c00', border: '1px solid #ffe0b2' }
        };

        const style = styles[type] || styles.info;
        Object.assign(statusEl.style, style);
        statusEl.textContent = message;
        statusEl.style.display = 'block';

        // Auto-hide non-error messages after 5 seconds
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    // Upload file to Supabase Storage
    async function uploadToStorage(file, filename) {
        const sb = getSupabaseClient();
        if (!sb) throw new Error('Supabase client not available');

        const { data, error } = await sb.storage
            .from(CONFIG.BUCKET)
            .upload(filename, file, { upsert: true });

        if (error) throw error;
        return data;
    }

    // Record file metadata in database
    async function recordFileMetadata(filename, fileSize, checksum) {
        const sb = getSupabaseClient();
        if (!sb) throw new Error('Supabase client not available');

        try {
            // Get current user
            const { data: { user } } = await sb.auth.getUser();
            const userId = user?.id || null;

            // Call the RPC function to insert and mark as current
            const { data, error } = await sb.rpc('insert_inventory_file_and_mark_current', {
                p_filename: filename,
                p_uploaded_by: userId,
                p_file_size: fileSize,
                p_checksum: checksum
            });

            if (error) throw error;
            return data;
        } catch (rpcError) {
            // Fallback: direct insert (may fail if RLS blocks non-admins)
            console.warn('RPC failed, trying direct insert:', rpcError);
            
            const { data: { user } } = await sb.auth.getUser();
            const { error: insertError } = await sb.from('inventory_files').insert({
                filename,
                uploaded_by: user?.id,
                file_size: fileSize,
                checksum,
                is_current: true
            });

            if (insertError) throw insertError;
            return { success: true, fallback: true };
        }
    }

    // Update local cache with new file info
    function updateLocalCache(filename, checksum) {
        try {
            const existing = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}');
            existing.fileName = filename;
            existing.checksum = checksum;
            existing.loadedAt = new Date().toISOString();
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(existing));

            // Dispatch event for other pages to refresh
            window.dispatchEvent(new CustomEvent('excelCacheUpdated', {
                detail: { filename, checksum }
            }));
        } catch (e) {
            console.warn('Failed to update local cache:', e);
        }
    }

    // Main upload function
    async function uploadExcelFile(file) {
        if (!file) throw new Error('No file provided');

        showStatus('Preparing upload...', 'info');

        // Generate filename (with optional timestamp prefix)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = CONFIG.USE_TIMESTAMP_PREFIX 
            ? `${timestamp}_${file.name}`
            : file.name;

        // Compute checksum for cache-busting
        showStatus('Computing file checksum...', 'info');
        const arrayBuffer = await file.arrayBuffer();
        const checksum = await computeChecksum(arrayBuffer);
        const fileSize = arrayBuffer.byteLength;

        // Upload to Supabase Storage
        showStatus('Uploading to Supabase Storage...', 'info');
        await uploadToStorage(file, filename);

        // Record metadata in database
        showStatus('Recording file metadata...', 'info');
        await recordFileMetadata(filename, fileSize, checksum);

        // Update local cache
        updateLocalCache(filename, checksum);

        showStatus(`✅ Successfully uploaded: ${filename} (${(fileSize / 1024).toFixed(1)} KB)`, 'success');

        return {
            filename,
            checksum,
            fileSize,
            uploadedAt: new Date().toISOString()
        };
    }

    // Add upload button to existing interface
    function addUploadButton() {
        console.log('🔧 Adding upload button...');
        
        const fileInput = document.getElementById('excel-input');
        const uploadBtn = document.getElementById('upload-btn');
        
        console.log('Elements found:', {
            fileInput: !!fileInput,
            uploadBtn: !!uploadBtn,
            existingSupabaseBtn: !!document.getElementById('supabase-upload-btn')
        });
        
        if (!fileInput || document.getElementById('supabase-upload-btn')) {
            console.log('Upload button not added:', !fileInput ? 'no file input' : 'button already exists');
            return;
        }

        const supabaseBtn = document.createElement('button');
        supabaseBtn.id = 'supabase-upload-btn';
        supabaseBtn.type = 'button';
        supabaseBtn.textContent = '📤 Upload to Supabase & Publish';
        supabaseBtn.className = 'w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors mt-2';
        supabaseBtn.style.marginTop = '8px';

        // Insert after the existing upload button or file input
        const insertAfter = uploadBtn || fileInput;
        insertAfter.parentNode.insertBefore(supabaseBtn, insertAfter.nextSibling);
        
        console.log('✅ Upload button added successfully');

        // Add click handler
        supabaseBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('📤 Upload button clicked');
            
            const file = fileInput.files?.[0];
            if (!file) {
                showStatus('Please select an Excel file first', 'warning');
                return;
            }

            try {
                supabaseBtn.disabled = true;
                supabaseBtn.textContent = '⏳ Uploading...';
                
                console.log('Starting upload for file:', file.name);
                const result = await uploadExcelFile(file);
                console.log('Upload completed:', result);
                
                // Optionally trigger any existing processing
                if (window.processFile && typeof window.processFile === 'function') {
                    showStatus('Processing file data...', 'info');
                    await window.processFile();
                }

            } catch (error) {
                console.error('Upload failed:', error);
                showStatus(`❌ Upload failed: ${error.message}`, 'error');
                alert(`Upload failed: ${error.message}`);
            } finally {
                supabaseBtn.disabled = false;
                supabaseBtn.textContent = '📤 Upload to Supabase & Publish';
            }
        });
    }

    // Add current file info display
    function addFileInfoDisplay() {
        if (document.getElementById('current-file-info')) return;

        const sb = getSupabaseClient();
        if (!sb) return;

        const infoDiv = document.createElement('div');
        infoDiv.id = 'current-file-info';
        infoDiv.style.cssText = `
            margin: 10px 0;
            padding: 10px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-size: 13px;
        `;

        // Find a good place to insert
        const uploadArea = document.getElementById('excel-input')?.parentNode ||
                         document.querySelector('.upload-area') ||
                         document.body;
        uploadArea.appendChild(infoDiv);

        // Function to update the display
        async function updateFileInfo() {
            try {
                const { data, error } = await sb.rpc('get_current_file_info');
                if (error) throw error;

                if (data && data.length > 0) {
                    const fileInfo = data[0];
                    const uploadDate = new Date(fileInfo.uploaded_at).toLocaleString();
                    infoDiv.innerHTML = `
                        <strong>📁 Current File:</strong> ${fileInfo.filename}<br>
                        <strong>📅 Uploaded:</strong> ${uploadDate}<br>
                        <strong>🔗 Checksum:</strong> ${fileInfo.checksum?.substring(0, 8)}...
                    `;
                } else {
                    infoDiv.innerHTML = '<em>No inventory file uploaded yet</em>';
                }
            } catch (error) {
                infoDiv.innerHTML = `<em>Error loading file info: ${error.message}</em>`;
            }
        }

        // Update on load and when files change
        updateFileInfo();
        window.addEventListener('excelCacheUpdated', updateFileInfo);
    }

    // Initialize when DOM is ready
    function initialize() {
        console.log('🚀 Initializing Supabase Excel upload integration...');
        
        const sb = getSupabaseClient();
        if (!sb) {
            console.warn('❌ Supabase client not found. Upload functionality will not be available.');
            console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('supabase')));
            return;
        }

        console.log('✅ Supabase client found, adding upload button...');
        addUploadButton();
        addFileInfoDisplay();

        // Hook into existing file input if present
        const fileInput = document.getElementById('excel-input');
        const uploadBtn = document.getElementById('upload-btn');

        console.log('Found elements:', {
            fileInput: !!fileInput,
            uploadBtn: !!uploadBtn
        });

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                fileInput.click();
            });
        }

        console.log('✅ Supabase Excel upload integration initialized');
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Add a small delay to ensure Supabase client is initialized
            setTimeout(initialize, 100);
        });
    } else {
        // Add a small delay to ensure Supabase client is initialized
        setTimeout(initialize, 100);
    }

    // Also try to initialize after a longer delay if the first attempt failed
    setTimeout(() => {
        if (!document.getElementById('supabase-upload-btn')) {
            console.log('🔄 Retrying Supabase integration initialization...');
            initialize();
        }
    }, 2000);

    // Export for debugging
    window.SupabaseExcelUpload = {
        uploadFile: uploadExcelFile,
        showStatus,
        getSupabaseClient
    };

})();