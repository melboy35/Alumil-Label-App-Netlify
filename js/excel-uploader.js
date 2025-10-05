/**
 * Alumil Excel Upload Manager for Supabase
 * Handles Excel file uploads and data synchronization to Supabase database
 */

class AlumilExcelUploader {
  constructor(supabaseClient, organizationId = '00000000-0000-0000-0000-000000000000') {
    this.supabase = supabaseClient;
    this.orgId = organizationId;
    this.isUploading = false;
  }

  /**
   * Initialize the uploader with UI event listeners
   */
  init() {
    this.bindEventListeners();
    this.loadExistingData();
  }

  /**
   * Bind event listeners to upload buttons and file inputs
   */
  bindEventListeners() {
    const uploadBtn = document.getElementById('excel-upload-btn');
    const fileInput = document.getElementById('excel-file-input');
    const clearBtn = document.getElementById('clear-data-btn');
    const publishBtn = document.getElementById('publish-live-btn');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearData());
    }

    if (publishBtn) {
      publishBtn.addEventListener('click', () => this.publishToDatabase());
    }
  }

  /**
   * Handle file selection and processing
   */
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.validateFile(file)) return;

    try {
      this.setUploadStatus('processing', `Processing ${file.name}...`);
      const data = await this.processExcelFile(file);
      
      // Store locally first
      this.storeDataLocally(data, file.name);
      
      // Update UI
      this.updateUI(data, file.name);
      
      this.setUploadStatus('success', `File processed successfully! ${data.profiles.length} profiles and ${data.accessories.length} accessories loaded.`);
      
    } catch (error) {
      console.error('File processing error:', error);
      this.setUploadStatus('error', `Error processing file: ${error.message}`);
    }
  }

  /**
   * Validate uploaded file
   */
  validateFile(file) {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      this.setUploadStatus('error', 'Please upload a valid Excel (.xlsx, .xls) or CSV file.');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      this.setUploadStatus('error', 'File size too large. Please upload a file smaller than 10MB.');
      return false;
    }

    return true;
  }

  /**
   * Process Excel file and extract data
   */
  async processExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Find profiles and accessories sheets
          const profilesSheet = this.findSheet(workbook, ['profiles', 'profile', 'prof']);
          const accessoriesSheet = this.findSheet(workbook, ['accessories', 'accessory', 'acc']);
          
          const profiles = profilesSheet ? this.processProfilesSheet(workbook.Sheets[profilesSheet]) : [];
          const accessories = accessoriesSheet ? this.processAccessoriesSheet(workbook.Sheets[accessoriesSheet]) : [];
          
          resolve({
            profiles,
            accessories,
            fileName: file.name,
            fileSize: file.size,
            processedAt: new Date().toISOString()
          });
          
        } catch (error) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Find sheet by name patterns
   */
  findSheet(workbook, patterns) {
    const sheetNames = workbook.SheetNames;
    
    for (const pattern of patterns) {
      const found = sheetNames.find(name => 
        name.toLowerCase().includes(pattern.toLowerCase())
      );
      if (found) return found;
    }
    
    // Fallback to first sheet for profiles, second for accessories
    return sheetNames[patterns.includes('prof') ? 0 : 1];
  }

  /**
   * Process profiles sheet data
   */
  processProfilesSheet(worksheet) {
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    return rawData.map(row => ({
      code: this.cleanString(row['Code'] || row['Item Code'] || row['Profile Code'] || row['code'] || ''),
      description: this.cleanString(row['Description'] || row['Desc'] || row['Name'] || row['description'] || ''),
      length: this.parseNumber(row['Length'] || row['Len'] || row['length']),
      color: this.cleanString(row['Color'] || row['Colour'] || row['color'] || ''),
      alloy: this.cleanString(row['Alloy'] || row['alloy'] || ''),
      system: this.cleanString(row['System'] || row['system'] || ''),
      warehouse_no: this.cleanString(row['Warehouse'] || row['Warehouse No'] || row['warehouse_no'] || ''),
      rack_no: this.cleanString(row['Rack'] || row['Rack No'] || row['rack_no'] || ''),
      quantity: this.parseNumber(row['Quantity'] || row['Qty'] || row['quantity']) || 0,
      unit: this.cleanString(row['Unit'] || row['UOM'] || row['unit'] || 'pcs')
    })).filter(item => item.code); // Only include items with codes
  }

  /**
   * Process accessories sheet data
   */
  processAccessoriesSheet(worksheet) {
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    return rawData.map(row => ({
      code: this.cleanString(row['Code'] || row['Item Code'] || row['Accessory Code'] || row['code'] || ''),
      description: this.cleanString(row['Description'] || row['Desc'] || row['Name'] || row['description'] || ''),
      unit: this.cleanString(row['Unit'] || row['UOM'] || row['unit'] || 'pcs'),
      category: this.cleanString(row['Category'] || row['Type'] || row['category'] || ''),
      warehouse_no: this.cleanString(row['Warehouse'] || row['Warehouse No'] || row['warehouse_no'] || ''),
      rack_no: this.cleanString(row['Rack'] || row['Rack No'] || row['rack_no'] || ''),
      quantity: this.parseNumber(row['Quantity'] || row['Qty'] || row['quantity']) || 0
    })).filter(item => item.code); // Only include items with codes
  }

  /**
   * Clean and normalize string values
   */
  cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /**
   * Parse numeric values safely
   */
  parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Store data locally in localStorage
   */
  storeDataLocally(data, fileName) {
    const cacheData = {
      profiles: data.profiles,
      accessories: data.accessories,
      fileName: fileName,
      fileSize: data.fileSize,
      loadedAt: data.processedAt,
      version: Date.now() // Simple versioning
    };
    
    localStorage.setItem('excelCache', JSON.stringify(cacheData));
  }

  /**
   * Publish data to Supabase database
   */
  async publishToDatabase() {
    if (this.isUploading) return;

    try {
      this.isUploading = true;
      this.setUploadStatus('uploading', 'Publishing data to database...');

      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get data from localStorage
      const cachedData = JSON.parse(localStorage.getItem('excelCache') || '{}');
      if (!cachedData.profiles && !cachedData.accessories) {
        throw new Error('No data to publish. Please upload an Excel file first.');
      }

      // Prepare data for database
      const profilesData = cachedData.profiles.map(item => ({
        ...item,
        organization_id: this.orgId,
        updated_at: new Date().toISOString()
      }));

      const accessoriesData = cachedData.accessories.map(item => ({
        ...item,
        organization_id: this.orgId,
        updated_at: new Date().toISOString()
      }));

      // Upload in batches to avoid timeout
      if (profilesData.length > 0) {
        await this.uploadInBatches('inventory_profiles', profilesData);
      }

      if (accessoriesData.length > 0) {
        await this.uploadInBatches('inventory_accessories', accessoriesData);
      }

      // Record upload history
      await this.recordUploadHistory(user.id, cachedData, profilesData.length, accessoriesData.length);

      this.setUploadStatus('success', 
        `✅ Data published successfully! ${profilesData.length} profiles and ${accessoriesData.length} accessories are now available to all users.`
      );

      // Trigger data refresh for all users
      this.broadcastDataUpdate();

    } catch (error) {
      console.error('Database upload error:', error);
      this.setUploadStatus('error', `Failed to publish data: ${error.message}`);
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Upload data in batches to avoid Supabase limits
   */
  async uploadInBatches(table, data, batchSize = 1000) {
    // First, clear existing data for this organization
    const { error: deleteError } = await this.supabase
      .from(table)
      .delete()
      .eq('organization_id', this.orgId);

    if (deleteError) {
      console.warn(`Warning: Could not clear existing ${table} data:`, deleteError);
    }

    // Upload in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from(table)
        .insert(batch);

      if (error) {
        throw new Error(`Failed to upload batch ${Math.floor(i/batchSize) + 1} to ${table}: ${error.message}`);
      }

      // Update progress
      const progress = Math.min(100, Math.round(((i + batch.length) / data.length) * 100));
      this.setUploadStatus('uploading', `Uploading ${table}... ${progress}%`);
    }
  }

  /**
   * Record upload history
   */
  async recordUploadHistory(userId, cachedData, profilesCount, accessoriesCount) {
    const { error } = await this.supabase
      .from('data_uploads')
      .insert({
        organization_id: this.orgId,
        uploaded_by: userId,
        file_name: cachedData.fileName,
        file_size: cachedData.fileSize,
        profiles_count: profilesCount,
        accessories_count: accessoriesCount,
        upload_status: 'completed',
        notes: `Uploaded via admin panel`
      });

    if (error) {
      console.warn('Could not record upload history:', error);
    }
  }

  /**
   * Clear local data
   */
  clearData() {
    if (confirm('Are you sure you want to clear the local data? This will not affect the published database.')) {
      localStorage.removeItem('excelCache');
      this.updateUI({ profiles: [], accessories: [] }, '');
      this.setUploadStatus('info', 'Local data cleared.');
    }
  }

  /**
   * Load existing data from localStorage
   */
  loadExistingData() {
    try {
      const cachedData = JSON.parse(localStorage.getItem('excelCache') || '{}');
      if (cachedData.profiles || cachedData.accessories) {
        this.updateUI(cachedData, cachedData.fileName || 'Cached Data');
        this.setUploadStatus('info', `Loaded cached data: ${cachedData.profiles?.length || 0} profiles, ${cachedData.accessories?.length || 0} accessories`);
      }
    } catch (error) {
      console.warn('Could not load cached data:', error);
    }
  }

  /**
   * Update UI with current data
   */
  updateUI(data, fileName) {
    // Update counters
    const profilesCount = data.profiles?.length || 0;
    const accessoriesCount = data.accessories?.length || 0;
    const totalCount = profilesCount + accessoriesCount;

    // Update dashboard counters
    this.updateElement('stat-total-items', totalCount);
    this.updateElement('profiles-count', profilesCount);
    this.updateElement('accessories-count', accessoriesCount);

    // Update modal indicators
    this.updateElement('count-profiles', `${profilesCount} item${profilesCount === 1 ? '' : 's'}`);
    this.updateElement('count-accessories', `${accessoriesCount} item${accessoriesCount === 1 ? '' : 's'}`);

    // Update file name display
    this.updateElement('file-name-display', fileName ? `File: ${fileName}` : 'No file loaded');

    // Update status indicators
    this.updateStatusDots(profilesCount > 0, accessoriesCount > 0);

    // Show data status
    const dataStatus = document.getElementById('data-status');
    if (dataStatus) {
      dataStatus.classList.toggle('hidden', !fileName);
    }
  }

  /**
   * Update element text content safely
   */
  updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = content;
    }
  }

  /**
   * Update status indicator dots
   */
  updateStatusDots(hasProfiles, hasAccessories) {
    const profileDot = document.getElementById('dot-profiles');
    const accessoryDot = document.getElementById('dot-accessories');

    if (profileDot) {
      profileDot.style.backgroundColor = hasProfiles ? '#22c55e' : '#6b7280';
    }

    if (accessoryDot) {
      accessoryDot.style.backgroundColor = hasAccessories ? '#22c55e' : '#6b7280';
    }
  }

  /**
   * Set upload status message
   */
  setUploadStatus(type, message) {
    const statusElement = document.getElementById('upload-status');
    const uploadBtn = document.getElementById('excel-upload-btn');
    const publishBtn = document.getElementById('publish-live-btn');

    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `upload-status ${type}`;
      statusElement.style.display = 'block'; // Ensure it's visible
      console.log(`📊 Status: ${type} - ${message}`);
    }

    // Update button states
    if (uploadBtn) {
      uploadBtn.disabled = type === 'processing' || type === 'uploading';
    }

    if (publishBtn) {
      publishBtn.disabled = type === 'processing' || type === 'uploading';
      publishBtn.textContent = type === 'uploading' ? 'Publishing...' : 'Publish to Database (All Users)';
    }

    // Auto-clear success/info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (statusElement) {
          statusElement.textContent = '';
          statusElement.style.display = 'none';
        }
      }, 5000);
    }
  }

  /**
   * Broadcast data update to all connected users
   */
  broadcastDataUpdate() {
    // This could be extended to use Supabase realtime subscriptions
    // For now, we'll trigger a custom event that other parts of the app can listen to
    window.dispatchEvent(new CustomEvent('alumilDataUpdated', {
      detail: { timestamp: new Date().toISOString() }
    }));
  }
}

// Export for use in other scripts
window.AlumilExcelUploader = AlumilExcelUploader;