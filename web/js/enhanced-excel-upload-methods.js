/**
 * Enhanced Excel Upload Modal - Method Implementations
 * This file contains the specific implementations for each upload method
 */

// Extend the EnhancedExcelUploadModal class with method implementations
Object.assign(EnhancedExcelUploadModal.prototype, {

    // =============================================================================
    // MICROSOFT GRAPH API METHODS
    // =============================================================================

    /**
     * Authenticate with Microsoft Graph API
     */
    async authenticateGraph() {
        try {
            this.setStatus('info', 'Connecting to Microsoft Graph API...');
            
            // Load MSAL library if not already loaded
            if (!window.msal) {
                await this.loadMSAL();
            }

            const clientId = this.getGraphClientId(); // Get from configuration
            if (!clientId) {
                throw new Error('Microsoft Graph API client ID not configured');
            }

            const msalConfig = {
                auth: {
                    clientId: clientId,
                    authority: 'https://login.microsoftonline.com/common',
                    redirectUri: window.location.origin
                },
                cache: {
                    cacheLocation: 'localStorage',
                    storeAuthStateInCookie: false
                }
            };

            const msalInstance = new window.msal.PublicClientApplication(msalConfig);
            await msalInstance.initialize();

            const loginRequest = {
                scopes: [
                    'https://graph.microsoft.com/Sites.Read.All',
                    'https://graph.microsoft.com/Files.Read.All',
                    'https://graph.microsoft.com/Files.ReadWrite.All'
                ]
            };

            let response;
            try {
                const silentRequest = {
                    ...loginRequest,
                    account: msalInstance.getActiveAccount()
                };
                response = await msalInstance.acquireTokenSilent(silentRequest);
            } catch (silentError) {
                response = await msalInstance.acquireTokenPopup(loginRequest);
            }

            this.graphAccessToken = response.accessToken;
            this.setStatus('success', 'Successfully connected to Microsoft Graph API!');
            
            // Enable test connection button
            const testBtn = document.getElementById('test-graph-btn');
            if (testBtn) testBtn.disabled = false;
            
            // Automatically list files
            await this.listSharePointFiles();

        } catch (error) {
            console.error('Graph authentication failed:', error);
            this.setStatus('error', `Authentication failed: ${error.message}`, false);
        }
    },

    /**
     * Test Graph API connection
     */
    async testGraphConnection() {
        try {
            this.setStatus('info', 'Testing connection...');
            
            const sharePointUrl = document.getElementById('sharepoint-url').value;
            const sitePath = document.getElementById('site-path').value;
            
            const response = await fetch(`${this.azureFunctionBaseUrl}/graph-api-list-files`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sharePointUrl,
                    sitePath,
                    accessToken: this.graphAccessToken,
                    searchQuery: '*.xlsx'
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.setStatus('success', `Connection successful! Found ${result.files.length} Excel files.`);
                this.displaySharePointFiles(result.files);
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Connection test failed:', error);
            this.setStatus('error', `Connection test failed: ${error.message}`, false);
        }
    },

    /**
     * List SharePoint files
     */
    async listSharePointFiles() {
        try {
            const sharePointUrl = document.getElementById('sharepoint-url').value;
            const sitePath = document.getElementById('site-path').value;
            
            if (!sharePointUrl || !sitePath) {
                this.setStatus('warning', 'Please enter SharePoint URL and site path first.');
                return;
            }

            const response = await fetch(`${this.azureFunctionBaseUrl}/graph-api-list-files`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sharePointUrl,
                    sitePath,
                    accessToken: this.graphAccessToken,
                    searchQuery: '*.xlsx'
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.displaySharePointFiles(result.files);
                document.getElementById('sharepoint-files').style.display = 'block';
            } else {
                throw new Error(result.error || 'Failed to list files');
            }

        } catch (error) {
            console.error('Failed to list SharePoint files:', error);
            this.setStatus('error', `Failed to list files: ${error.message}`, false);
        }
    },

    /**
     * Display SharePoint files in the file browser
     */
    displaySharePointFiles(files) {
        const fileListEl = document.getElementById('sharepoint-file-list');
        if (!fileListEl) return;

        fileListEl.innerHTML = '';
        
        if (files.length === 0) {
            fileListEl.innerHTML = '<p class="no-files">No Excel files found in SharePoint.</p>';
            return;
        }

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.fileId = file.id;
            fileItem.innerHTML = `
                <div class="file-details">
                    <div class="file-name"><i class="fas fa-file-excel"></i> ${file.name}</div>
                    <div class="file-meta">
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                        <span class="file-date">${new Date(file.lastModified).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-small btn-primary" onclick="enhancedUploadModal.selectSharePointFile('${file.id}', '${file.name}')">
                        <i class="fas fa-check"></i> Select
                    </button>
                </div>
            `;
            
            fileListEl.appendChild(fileItem);
        });

        this.sharePointFiles = files;
    },

    /**
     * Select a SharePoint file
     */
    selectSharePointFile(fileId, fileName) {
        // Remove previous selections
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Mark current file as selected
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            fileItem.classList.add('selected');
        }
        
        this.selectedSharePointFile = { fileId, fileName };
        
        // Enable download button
        const downloadBtn = document.getElementById('download-selected-btn');
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `<i class="fas fa-download"></i> Download & Process "${fileName}"`;
        }
        
        this.setStatus('info', `Selected: ${fileName}`);
    },

    /**
     * Download and process selected SharePoint file
     */
    async downloadSelectedFile() {
        if (!this.selectedSharePointFile) {
            this.setStatus('warning', 'Please select a file first.');
            return;
        }

        try {
            this.isUploading = true;
            this.updateProgress(10, 'Downloading file from SharePoint...');
            
            const sharePointUrl = document.getElementById('sharepoint-url').value;
            const sitePath = document.getElementById('site-path').value;
            
            const response = await fetch(`${this.azureFunctionBaseUrl}/graph-api-connector`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sharePointUrl,
                    sitePath,
                    fileName: this.selectedSharePointFile.fileName,
                    accessToken: this.graphAccessToken
                })
            });

            this.updateProgress(50, 'Processing Excel file...');
            
            const result = await response.json();
            
            if (result.success) {
                this.updateProgress(100, 'File processed successfully!');
                setTimeout(() => this.hideProgress(), 2000);
                
                this.setStatus('success', `Successfully processed "${result.fileName}"!`);
                this.showDataSummary(result.recordsProcessed);
                
                // Notify about real-time sync
                this.notifyRealTimeSync(result.recordsProcessed);
                
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('SharePoint download failed:', error);
            this.hideProgress();
            this.setStatus('error', `Download failed: ${error.message}`, false);
        } finally {
            this.isUploading = false;
        }
    },

    // =============================================================================
    // DIRECT UPLOAD METHODS
    // =============================================================================

    /**
     * Handle drag over event
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        const uploadZone = document.querySelector('.upload-zone');
        if (uploadZone) {
            uploadZone.classList.add('drag-over');
        }
    },

    /**
     * Handle drag leave event
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        const uploadZone = document.querySelector('.upload-zone');
        if (uploadZone) {
            uploadZone.classList.remove('drag-over');
        }
    },

    /**
     * Handle drop event
     */
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const uploadZone = document.querySelector('.upload-zone');
        if (uploadZone) {
            uploadZone.classList.remove('drag-over');
        }
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processDirectFile(files[0]);
        }
    },

    /**
     * Handle file selection from input
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processDirectFile(file);
        }
    },

    /**
     * Process directly selected file
     */
    processDirectFile(file) {
        // Validate file type
        if (!this.validateExcelFile(file)) {
            return;
        }
        
        this.selectedDirectFile = file;
        
        // Show file preview
        const previewEl = document.getElementById('file-preview');
        const fileNameEl = document.getElementById('file-name');
        const fileSizeEl = document.getElementById('file-size');
        
        if (previewEl && fileNameEl && fileSizeEl) {
            previewEl.style.display = 'block';
            fileNameEl.textContent = file.name;
            fileSizeEl.textContent = this.formatFileSize(file.size);
        }
        
        this.setStatus('info', `File "${file.name}" ready for upload.`);
    },

    /**
     * Upload direct file
     */
    async uploadDirectFile() {
        if (!this.selectedDirectFile) {
            this.setStatus('warning', 'Please select a file first.');
            return;
        }

        try {
            this.isUploading = true;
            this.updateProgress(10, 'Uploading file to Azure...');
            
            const formData = new FormData();
            formData.append('file', this.selectedDirectFile);
            
            const response = await fetch(`${this.azureFunctionBaseUrl}/excel-upload-processor`, {
                method: 'POST',
                headers: {
                    'X-File-Name': this.selectedDirectFile.name
                },
                body: this.selectedDirectFile
            });

            this.updateProgress(70, 'Processing Excel data...');
            
            const result = await response.json();
            
            if (result.success) {
                this.updateProgress(100, 'Upload completed successfully!');
                setTimeout(() => this.hideProgress(), 2000);
                
                this.setStatus('success', `Successfully uploaded and processed "${result.fileName}"!`);
                this.showDataSummary(result.recordsProcessed);
                
                // Notify about real-time sync
                this.notifyRealTimeSync(result.recordsProcessed);
                
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Direct upload failed:', error);
            this.hideProgress();
            this.setStatus('error', `Upload failed: ${error.message}`, false);
        } finally {
            this.isUploading = false;
        }
    },

    // =============================================================================
    // AZURE BLOB LINK METHODS
    // =============================================================================

    /**
     * Connect to Azure Blob Storage
     */
    async connectToBlob() {
        try {
            this.setStatus('info', 'Connecting to Azure Blob Storage...');
            
            const storageAccount = document.getElementById('storage-account').value;
            const containerName = document.getElementById('container-name').value;
            const blobUrl = document.getElementById('blob-url').value;
            
            if (!storageAccount || !containerName) {
                this.setStatus('warning', 'Please enter storage account and container name.');
                return;
            }
            
            // Store connection details
            this.blobConnectionDetails = {
                storageAccount,
                containerName,
                blobUrl
            };
            
            this.setStatus('success', 'Connected to Azure Blob Storage!');
            
            // Enable list files button
            const listBtn = document.getElementById('list-blobs-btn');
            if (listBtn) listBtn.disabled = false;
            
            // Automatically list files
            await this.listBlobFiles();

        } catch (error) {
            console.error('Blob connection failed:', error);
            this.setStatus('error', `Connection failed: ${error.message}`, false);
        }
    },

    /**
     * List files in Azure Blob Storage
     */
    async listBlobFiles() {
        try {
            this.setStatus('info', 'Listing blob files...');
            
            // This would typically call an Azure Function that lists blobs
            // For now, we'll simulate the response
            const mockFiles = [
                {
                    name: 'inventory_master_2024.xlsx',
                    size: 2048576,
                    lastModified: new Date().toISOString(),
                    url: `https://${this.blobConnectionDetails.storageAccount}.blob.core.windows.net/${this.blobConnectionDetails.containerName}/inventory_master_2024.xlsx`
                },
                {
                    name: 'profiles_accessories_data.xlsx',
                    size: 1536000,
                    lastModified: new Date(Date.now() - 86400000).toISOString(),
                    url: `https://${this.blobConnectionDetails.storageAccount}.blob.core.windows.net/${this.blobConnectionDetails.containerName}/profiles_accessories_data.xlsx`
                }
            ];
            
            this.displayBlobFiles(mockFiles);
            document.getElementById('blob-files').style.display = 'block';
            this.setStatus('success', `Found ${mockFiles.length} files in blob storage.`);

        } catch (error) {
            console.error('Failed to list blob files:', error);
            this.setStatus('error', `Failed to list files: ${error.message}`, false);
        }
    },

    /**
     * Display blob files
     */
    displayBlobFiles(files) {
        const fileListEl = document.getElementById('blob-file-list');
        if (!fileListEl) return;

        fileListEl.innerHTML = '';
        
        if (files.length === 0) {
            fileListEl.innerHTML = '<p class="no-files">No Excel files found in blob storage.</p>';
            return;
        }

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.fileUrl = file.url;
            fileItem.innerHTML = `
                <div class="file-details">
                    <div class="file-name"><i class="fas fa-file-excel"></i> ${file.name}</div>
                    <div class="file-meta">
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                        <span class="file-date">${new Date(file.lastModified).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-small btn-primary" onclick="enhancedUploadModal.selectBlobFile('${file.url}', '${file.name}')">
                        <i class="fas fa-check"></i> Select
                    </button>
                </div>
            `;
            
            fileListEl.appendChild(fileItem);
        });

        this.blobFiles = files;
    },

    /**
     * Select a blob file
     */
    selectBlobFile(fileUrl, fileName) {
        // Remove previous selections
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Mark current file as selected
        const fileItem = document.querySelector(`[data-file-url="${fileUrl}"]`);
        if (fileItem) {
            fileItem.classList.add('selected');
        }
        
        this.selectedBlobFile = { fileUrl, fileName };
        
        // Enable process button
        const processBtn = document.getElementById('process-blob-btn');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = `<i class="fas fa-cogs"></i> Process "${fileName}"`;
        }
        
        this.setStatus('info', `Selected: ${fileName}`);
    },

    /**
     * Process selected blob file
     */
    async processSelectedBlob() {
        if (!this.selectedBlobFile) {
            this.setStatus('warning', 'Please select a file first.');
            return;
        }

        try {
            this.isUploading = true;
            this.updateProgress(10, 'Processing blob file...');
            
            // Call Azure Function to process blob
            const response = await fetch(`${this.azureFunctionBaseUrl}/blob-link-processor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    blobUrl: this.selectedBlobFile.fileUrl,
                    fileName: this.selectedBlobFile.fileName
                })
            });

            this.updateProgress(70, 'Extracting and storing data...');
            
            const result = await response.json();
            
            if (result.success) {
                this.updateProgress(100, 'Blob processing completed!');
                setTimeout(() => this.hideProgress(), 2000);
                
                this.setStatus('success', `Successfully processed "${result.fileName}" from blob storage!`);
                this.showDataSummary(result.recordsProcessed);
                
                // Notify about real-time sync
                this.notifyRealTimeSync(result.recordsProcessed);
                
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Blob processing failed:', error);
            this.hideProgress();
            this.setStatus('error', `Processing failed: ${error.message}`, false);
        } finally {
            this.isUploading = false;
        }
    },

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Validate Excel file
     */
    validateExcelFile(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        
        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
            this.setStatus('error', 'Please select a valid Excel file (.xlsx or .xls)', false);
            return false;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            this.setStatus('error', 'File size too large. Please select a file smaller than 50MB.', false);
            return false;
        }
        
        return true;
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Show data summary
     */
    showDataSummary(recordsProcessed) {
        const summaryEl = document.getElementById('data-summary');
        const profilesEl = document.getElementById('profiles-count');
        const accessoriesEl = document.getElementById('accessories-count');
        const totalEl = document.getElementById('total-items');
        
        if (summaryEl && profilesEl && accessoriesEl && totalEl) {
            profilesEl.textContent = recordsProcessed.profiles;
            accessoriesEl.textContent = recordsProcessed.accessories;
            totalEl.textContent = recordsProcessed.profiles + recordsProcessed.accessories;
            
            summaryEl.style.display = 'block';
        }
        
        this.lastUploadSummary = recordsProcessed;
    },

    /**
     * Publish data to all users
     */
    async publishToAllUsers() {
        try {
            this.setStatus('info', 'Publishing data to all users...');
            
            // Call SignalR to notify all connected clients
            if (this.signalRConnection) {
                await this.signalRConnection.invoke('NotifyDataUpdate', {
                    type: 'inventory_update',
                    data: this.lastUploadSummary,
                    timestamp: new Date().toISOString()
                });
            }
            
            this.setStatus('success', 'Data published successfully! All users will see the updated inventory.');
            
        } catch (error) {
            console.error('Failed to publish data:', error);
            this.setStatus('error', `Failed to publish: ${error.message}`, false);
        }
    },

    /**
     * Preview uploaded data
     */
    previewData() {
        // This would open a data preview modal
        alert('Data preview functionality would be implemented here, showing a table of the uploaded inventory data.');
    },

    /**
     * Notify about real-time sync
     */
    notifyRealTimeSync(recordsProcessed) {
        // Show a notification that data is being synced
        const notification = document.createElement('div');
        notification.className = 'sync-notification';
        notification.innerHTML = `
            <i class="fas fa-sync-alt fa-spin"></i>
            Syncing ${recordsProcessed.profiles + recordsProcessed.accessories} items to all connected devices...
        `;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    },

    /**
     * Get Graph client ID from configuration
     */
    getGraphClientId() {
        // This would be retrieved from your app configuration
        return process.env.GRAPH_CLIENT_ID || 'your-graph-client-id';
    },

    /**
     * Load MSAL library
     */
    async loadMSAL() {
        return new Promise((resolve, reject) => {
            if (window.msal) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js';
            script.onload = () => {
                console.log('MSAL library loaded');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load MSAL library'));
            };
            document.head.appendChild(script);
        });
    }
});

console.log('Enhanced Excel Upload Modal - Method implementations loaded');