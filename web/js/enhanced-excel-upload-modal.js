/**
 * Enhanced Excel Upload Modal for Alumil Inventory System
 * Supports 3 upload methods: Graph API, Direct Upload, and Blob Link
 */

class EnhancedExcelUploadModal {
    constructor() {
        this.isUploading = false;
        this.currentMethod = null;
        this.graphClient = null;
        this.azureFunctionBaseUrl = '/api'; // Azure Functions endpoint
        this.signalRConnection = null;
        
        this.init();
    }

    /**
     * Initialize the enhanced upload modal
     */
    init() {
        this.createModalHTML();
        this.bindEventListeners();
        this.initializeSignalR();
        this.loadUserSettings();
    }

    /**
     * Create the enhanced modal HTML structure
     */
    createModalHTML() {
        const modalHTML = `
        <div id="enhanced-excel-modal" class="modal-overlay" style="display: none;">
            <div class="modal-container">
                <div class="modal-header">
                    <h2><i class="fas fa-file-excel"></i> Enhanced Excel Upload</h2>
                    <button class="modal-close" onclick="enhancedUploadModal.close()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <!-- Upload Method Selection -->
                    <div class="upload-method-selector">
                        <h3>Choose Upload Method:</h3>
                        <div class="method-cards">
                            <div class="method-card" data-method="graph-api" onclick="enhancedUploadModal.selectMethod('graph-api')">
                                <div class="method-icon">
                                    <i class="fab fa-microsoft"></i>
                                </div>
                                <div class="method-info">
                                    <h4>Microsoft Graph API</h4>
                                    <p>Connect to SharePoint Online</p>
                                    <span class="method-badge recommended">Recommended</span>
                                </div>
                            </div>
                            
                            <div class="method-card" data-method="direct-upload" onclick="enhancedUploadModal.selectMethod('direct-upload')">
                                <div class="method-icon">
                                    <i class="fas fa-upload"></i>
                                </div>
                                <div class="method-info">
                                    <h4>Direct Upload</h4>
                                    <p>Upload from local system</p>
                                    <span class="method-badge">Local Files</span>
                                </div>
                            </div>
                            
                            <div class="method-card" data-method="blob-link" onclick="enhancedUploadModal.selectMethod('blob-link')">
                                <div class="method-icon">
                                    <i class="fas fa-cloud"></i>
                                </div>
                                <div class="method-info">
                                    <h4>Azure Blob Link</h4>
                                    <p>Connect with existing blob storage</p>
                                    <span class="method-badge">Cloud Storage</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Method-specific content areas -->
                    
                    <!-- Graph API Method -->
                    <div id="graph-api-content" class="method-content" style="display: none;">
                        <div class="method-section">
                            <h4><i class="fab fa-microsoft"></i> Microsoft Graph API - SharePoint</h4>
                            <div class="form-group">
                                <label>SharePoint Site URL:</label>
                                <input type="url" id="sharepoint-url" placeholder="https://company.sharepoint.com/sites/sitename" 
                                       value="https://alumildxb.sharepoint.com/sites/WarehouseAPP" />
                            </div>
                            <div class="form-group">
                                <label>Site Path:</label>
                                <input type="text" id="site-path" placeholder="/sites/WarehouseAPP" 
                                       value="/sites/WarehouseAPP" />
                            </div>
                            <div class="button-group">
                                <button class="btn btn-primary" onclick="enhancedUploadModal.authenticateGraph()">
                                    <i class="fas fa-sign-in-alt"></i> Connect to SharePoint
                                </button>
                                <button class="btn btn-secondary" onclick="enhancedUploadModal.testGraphConnection()" 
                                        id="test-graph-btn" disabled>
                                    <i class="fas fa-check-circle"></i> Test Connection
                                </button>
                            </div>
                            
                            <!-- File browser for SharePoint -->
                            <div id="sharepoint-files" class="file-browser" style="display: none;">
                                <h5>Available Excel Files:</h5>
                                <div id="sharepoint-file-list" class="file-list"></div>
                                <button class="btn btn-success" onclick="enhancedUploadModal.downloadSelectedFile()" 
                                        id="download-selected-btn" disabled>
                                    <i class="fas fa-download"></i> Download & Process Selected File
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Direct Upload Method -->
                    <div id="direct-upload-content" class="method-content" style="display: none;">
                        <div class="method-section">
                            <h4><i class="fas fa-upload"></i> Direct File Upload</h4>
                            <div class="upload-zone" ondrop="enhancedUploadModal.handleDrop(event)" 
                                 ondragover="enhancedUploadModal.handleDragOver(event)" 
                                 ondragleave="enhancedUploadModal.handleDragLeave(event)">
                                <div class="upload-zone-content">
                                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                                    <p class="upload-text">Drag & Drop Excel files here</p>
                                    <p class="upload-subtext">or click to browse</p>
                                    <input type="file" id="direct-file-input" accept=".xlsx,.xls" 
                                           onchange="enhancedUploadModal.handleFileSelect(event)" style="display: none;" />
                                    <button class="btn btn-primary" onclick="document.getElementById('direct-file-input').click()">
                                        <i class="fas fa-folder-open"></i> Browse Files
                                    </button>
                                </div>
                            </div>
                            
                            <!-- File preview -->
                            <div id="file-preview" class="file-preview" style="display: none;">
                                <div class="file-info">
                                    <i class="fas fa-file-excel"></i>
                                    <span id="file-name"></span>
                                    <span id="file-size"></span>
                                </div>
                                <button class="btn btn-success" onclick="enhancedUploadModal.uploadDirectFile()" 
                                        id="upload-direct-btn">
                                    <i class="fas fa-cloud-upload-alt"></i> Upload & Process
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Blob Link Method -->
                    <div id="blob-link-content" class="method-content" style="display: none;">
                        <div class="method-section">
                            <h4><i class="fas fa-cloud"></i> Azure Blob Storage Link</h4>
                            <div class="form-group">
                                <label>Storage Account Name:</label>
                                <input type="text" id="storage-account" placeholder="mystorageaccount" />
                            </div>
                            <div class="form-group">
                                <label>Container Name:</label>
                                <input type="text" id="container-name" placeholder="excel-files" value="excel-uploads" />
                            </div>
                            <div class="form-group">
                                <label>Blob URL or SAS Token:</label>
                                <input type="url" id="blob-url" placeholder="https://storageaccount.blob.core.windows.net/container/file.xlsx" />
                            </div>
                            <div class="button-group">
                                <button class="btn btn-primary" onclick="enhancedUploadModal.connectToBlob()">
                                    <i class="fas fa-link"></i> Connect to Blob Storage
                                </button>
                                <button class="btn btn-secondary" onclick="enhancedUploadModal.listBlobFiles()" 
                                        id="list-blobs-btn" disabled>
                                    <i class="fas fa-list"></i> List Files
                                </button>
                            </div>
                            
                            <!-- Blob file browser -->
                            <div id="blob-files" class="file-browser" style="display: none;">
                                <h5>Available Files:</h5>
                                <div id="blob-file-list" class="file-list"></div>
                                <button class="btn btn-success" onclick="enhancedUploadModal.processSelectedBlob()" 
                                        id="process-blob-btn" disabled>
                                    <i class="fas fa-cogs"></i> Process Selected File
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Progress and Status -->
                    <div class="upload-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="upload-progress-fill"></div>
                        </div>
                        <div class="progress-text" id="upload-progress-text">Processing...</div>
                    </div>

                    <!-- Status Messages -->
                    <div id="upload-status" class="status-message" style="display: none;"></div>

                    <!-- Data Summary -->
                    <div id="data-summary" class="data-summary" style="display: none;">
                        <h4><i class="fas fa-chart-bar"></i> Upload Summary</h4>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">Profiles:</span>
                                <span class="stat-value" id="profiles-count">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Accessories:</span>
                                <span class="stat-value" id="accessories-count">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Total Items:</span>
                                <span class="stat-value" id="total-items">0</span>
                            </div>
                        </div>
                        <div class="summary-actions">
                            <button class="btn btn-success" onclick="enhancedUploadModal.publishToAllUsers()" 
                                    id="publish-btn">
                                <i class="fas fa-broadcast-tower"></i> Publish to All Users
                            </button>
                            <button class="btn btn-info" onclick="enhancedUploadModal.previewData()" 
                                    id="preview-btn">
                                <i class="fas fa-eye"></i> Preview Data
                            </button>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="enhancedUploadModal.close()">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button class="btn btn-info" onclick="enhancedUploadModal.showHelp()">
                        <i class="fas fa-question-circle"></i> Help
                    </button>
                </div>
            </div>
        </div>`;

        // Add modal to body if it doesn't exist
        if (!document.getElementById('enhanced-excel-modal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        // Add CSS styles
        this.addModalStyles();
    }

    /**
     * Add CSS styles for the modal
     */
    addModalStyles() {
        const styles = `
        <style>
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
        }

        .modal-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 90vw;
            max-height: 90vh;
            width: 800px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .modal-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }

        .modal-close {
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
        }

        .modal-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .modal-body {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        .method-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin: 16px 0;
        }

        .method-card {
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
            background: #f8fafc;
        }

        .method-card:hover {
            border-color: #667eea;
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
        }

        .method-card.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .method-icon {
            font-size: 48px;
            margin-bottom: 12px;
            color: #667eea;
        }

        .method-card.selected .method-icon {
            color: white;
        }

        .method-info h4 {
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 600;
        }

        .method-info p {
            margin: 0 0 12px 0;
            font-size: 14px;
            opacity: 0.8;
        }

        .method-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }

        .method-badge.recommended {
            background: #48bb78;
        }

        .method-content {
            margin-top: 24px;
            padding: 20px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background: #f8fafc;
        }

        .method-section h4 {
            margin: 0 0 20px 0;
            color: #2d3748;
            font-weight: 600;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            color: #4a5568;
        }

        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .button-group {
            display: flex;
            gap: 12px;
            margin: 20px 0;
        }

        .btn {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .btn-primary {
            background: #667eea;
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background: #5a67d8;
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: #718096;
            color: white;
        }

        .btn-secondary:hover:not(:disabled) {
            background: #4a5568;
        }

        .btn-success {
            background: #48bb78;
            color: white;
        }

        .btn-success:hover:not(:disabled) {
            background: #38a169;
        }

        .btn-info {
            background: #4299e1;
            color: white;
        }

        .btn-info:hover:not(:disabled) {
            background: #3182ce;
        }

        .upload-zone {
            border: 2px dashed #cbd5e0;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            transition: all 0.3s ease;
            background: white;
        }

        .upload-zone:hover {
            border-color: #667eea;
            background: #f7fafc;
        }

        .upload-zone.drag-over {
            border-color: #667eea;
            background: #ebf8ff;
            transform: scale(1.02);
        }

        .upload-icon {
            font-size: 48px;
            color: #a0aec0;
            margin-bottom: 16px;
        }

        .upload-text {
            font-size: 18px;
            font-weight: 500;
            color: #4a5568;
            margin: 0 0 8px 0;
        }

        .upload-subtext {
            color: #718096;
            margin: 0 0 20px 0;
        }

        .file-preview, .file-browser {
            margin-top: 20px;
            padding: 16px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        .file-info {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }

        .file-list {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin: 12px 0;
        }

        .file-item {
            padding: 12px;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            justify-content: between;
            align-items: center;
        }

        .file-item:hover {
            background: #f8fafc;
        }

        .file-item.selected {
            background: #ebf8ff;
            border-color: #667eea;
        }

        .file-item:last-child {
            border-bottom: none;
        }

        .upload-progress {
            margin: 20px 0;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
            width: 0%;
        }

        .progress-text {
            text-align: center;
            margin-top: 8px;
            font-size: 14px;
            color: #4a5568;
        }

        .status-message {
            padding: 12px 16px;
            border-radius: 8px;
            margin: 16px 0;
            font-size: 14px;
            font-weight: 500;
        }

        .status-message.success {
            background: #f0fff4;
            color: #22543d;
            border: 1px solid #9ae6b4;
        }

        .status-message.error {
            background: #fed7d7;
            color: #742a2a;
            border: 1px solid #feb2b2;
        }

        .status-message.info {
            background: #ebf8ff;
            color: #2a4365;
            border: 1px solid #90cdf4;
        }

        .status-message.warning {
            background: #fffbeb;
            color: #744210;
            border: 1px solid #f6e05e;
        }

        .data-summary {
            margin-top: 20px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }

        .data-summary h4 {
            margin: 0 0 16px 0;
            color: #2d3748;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }

        .stat-item {
            text-align: center;
            padding: 12px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        .stat-label {
            display: block;
            font-size: 12px;
            color: #718096;
            margin-bottom: 4px;
        }

        .stat-value {
            display: block;
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
        }

        .summary-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .modal-footer {
            padding: 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        @media (max-width: 768px) {
            .modal-container {
                width: 95vw;
                height: 95vh;
            }
            
            .method-cards {
                grid-template-columns: 1fr;
            }
            
            .button-group, .summary-actions {
                flex-direction: column;
            }
        }
        </style>`;

        if (!document.getElementById('enhanced-upload-modal-styles')) {
            document.head.insertAdjacentHTML('beforeend', styles.replace('<style>', '<style id="enhanced-upload-modal-styles">'));
        }
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.close();
            }
        });

        // Close modal on backdrop click
        const modal = document.getElementById('enhanced-excel-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }
    }

    /**
     * Initialize SignalR connection for real-time updates
     */
    async initializeSignalR() {
        try {
            // This will be implemented when SignalR is configured
            console.log('SignalR initialization placeholder');
        } catch (error) {
            console.warn('SignalR initialization failed:', error);
        }
    }

    /**
     * Load user settings and preferences
     */
    loadUserSettings() {
        const savedMethod = localStorage.getItem('preferredUploadMethod');
        if (savedMethod) {
            // Pre-select the user's preferred method
            console.log('Loaded preferred upload method:', savedMethod);
        }
    }

    /**
     * Show the modal
     */
    show() {
        const modal = document.getElementById('enhanced-excel-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Hide the modal
     */
    close() {
        const modal = document.getElementById('enhanced-excel-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            this.resetModal();
        }
    }

    /**
     * Check if modal is visible
     */
    isVisible() {
        const modal = document.getElementById('enhanced-excel-modal');
        return modal && modal.style.display !== 'none';
    }

    /**
     * Reset modal to initial state
     */
    resetModal() {
        this.currentMethod = null;
        this.isUploading = false;
        
        // Hide all method content areas
        document.querySelectorAll('.method-content').forEach(el => {
            el.style.display = 'none';
        });
        
        // Remove selection from method cards
        document.querySelectorAll('.method-card').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Hide progress and status
        const progressEl = document.querySelector('.upload-progress');
        const statusEl = document.getElementById('upload-status');
        const summaryEl = document.getElementById('data-summary');
        
        if (progressEl) progressEl.style.display = 'none';
        if (statusEl) statusEl.style.display = 'none';
        if (summaryEl) summaryEl.style.display = 'none';
    }

    /**
     * Select upload method
     */
    selectMethod(method) {
        this.currentMethod = method;
        
        // Save user preference
        localStorage.setItem('preferredUploadMethod', method);
        
        // Update UI
        document.querySelectorAll('.method-card').forEach(el => {
            el.classList.remove('selected');
        });
        
        document.querySelector(`[data-method="${method}"]`).classList.add('selected');
        
        // Show relevant content area
        document.querySelectorAll('.method-content').forEach(el => {
            el.style.display = 'none';
        });
        
        const contentEl = document.getElementById(`${method}-content`);
        if (contentEl) {
            contentEl.style.display = 'block';
        }
        
        this.setStatus('info', `${this.getMethodDisplayName(method)} selected. Configure the settings below.`);
    }

    /**
     * Get display name for method
     */
    getMethodDisplayName(method) {
        const names = {
            'graph-api': 'Microsoft Graph API',
            'direct-upload': 'Direct Upload',
            'blob-link': 'Azure Blob Link'
        };
        return names[method] || method;
    }

    /**
     * Set status message
     */
    setStatus(type, message, autoHide = true) {
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-message ${type}`;
            statusEl.style.display = 'block';
            
            if (autoHide && (type === 'success' || type === 'info')) {
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 5000);
            }
        }
        
        console.log(`Status: ${type} - ${message}`);
    }

    /**
     * Update progress
     */
    updateProgress(percentage, text) {
        const progressEl = document.querySelector('.upload-progress');
        const fillEl = document.getElementById('upload-progress-fill');
        const textEl = document.getElementById('upload-progress-text');
        
        if (progressEl) progressEl.style.display = 'block';
        if (fillEl) fillEl.style.width = `${percentage}%`;
        if (textEl) textEl.textContent = text;
    }

    /**
     * Hide progress
     */
    hideProgress() {
        const progressEl = document.querySelector('.upload-progress');
        if (progressEl) progressEl.style.display = 'none';
    }

    // Method implementations will be continued in the next part...
    
    /**
     * Show help information
     */
    showHelp() {
        const helpContent = `
        <h3>Enhanced Excel Upload Help</h3>
        <h4>Upload Methods:</h4>
        <ul>
            <li><strong>Microsoft Graph API:</strong> Connect directly to SharePoint Online to access your Excel files.</li>
            <li><strong>Direct Upload:</strong> Upload Excel files directly from your local computer.</li>
            <li><strong>Azure Blob Link:</strong> Connect to existing Azure Blob Storage containers.</li>
        </ul>
        <h4>Supported File Formats:</h4>
        <ul>
            <li>Excel 2007+ (.xlsx)</li>
            <li>Excel 97-2003 (.xls)</li>
        </ul>
        <h4>Real-time Sharing:</h4>
        <p>Once you upload and publish data, it becomes immediately available to all users across all devices.</p>
        `;
        
        alert(helpContent); // In a real app, use a proper modal
    }
}

// Initialize the enhanced upload modal
window.enhancedUploadModal = new EnhancedExcelUploadModal();