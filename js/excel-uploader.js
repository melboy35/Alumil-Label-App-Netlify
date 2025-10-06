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
    const clearCacheBtn = document.getElementById('clear-all-cache-btn');

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
    
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => this.clearAllUsersCache());
    }
  }
  
  /**
   * Clear cache for all users by bumping the inventory version
   */
  async clearAllUsersCache() {
    try {
      this.setUploadStatus('processing', 'Clearing cache for all users...');
      
      if (window.InventoryStateManager) {
        const inventoryManager = new window.InventoryStateManager(this.supabase, this.orgId);
        await inventoryManager.bumpInventoryVersion();
        
        this.setUploadStatus('success', 'Successfully cleared cache for all users. Their apps will refresh data automatically.');
      } else {
        throw new Error('InventoryStateManager not available');
      }
    } catch (error) {
      console.error('Error clearing all users cache:', error);
      this.setUploadStatus('error', `Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Handle file selection and processing (refactored: always use storage URL)
   */
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.validateFile(file)) return;

    try {
      this.setUploadStatus('processing', `Uploading ${file.name} to cloud storage...`);

      // Upload file to Supabase Storage
      const storagePath = `uploads/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await this.supabase
        .storage
        .from('excel-files')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw new Error('Failed to upload file to storage: ' + uploadError.message);

      // Get public URL for the uploaded file
      const { data: publicUrlData } = this.supabase
        .storage
        .from('excel-files')
        .getPublicUrl(storagePath);
      const fileUrl = publicUrlData?.publicUrl;
      if (!fileUrl) throw new Error('Could not get public URL for uploaded file.');

      this.setUploadStatus('processing', 'Fetching and parsing Excel from storage...');

      // Fetch the file from the storage URL
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch uploaded file from storage.');
      const arrayBuffer = await response.arrayBuffer();

      // Parse Excel from arrayBuffer
      const data = await this.processExcelFileFromBuffer(arrayBuffer, file.name);

      // Update UI (show counts, etc.)
      this.updateUI(data, file.name);

      // Optionally store file URL/version for UX
      localStorage.setItem('excelFileMeta', JSON.stringify({ fileUrl, uploadedAt: new Date().toISOString() }));

      this.setUploadStatus('success', `File uploaded and parsed! ${data.profiles.length} profiles and ${data.accessories.length} accessories loaded. Ready to publish to database.`);

      // Optionally, you can trigger the upsert here or require a separate publish action
      // await this.publishToDatabaseFromData(data, fileUrl);

    } catch (error) {
      console.error('File upload/parse error:', error);
      this.setUploadStatus('error', `Error uploading or parsing file: ${error.message}`);
    }
  }

  /**
   * Parse Excel file from ArrayBuffer (from storage URL)
   */
  async processExcelFileFromBuffer(arrayBuffer, fileName) {
    try {
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false,
        range: undefined
      });

      // Find profiles and accessories sheets
      const profilesSheet = this.findSheet(workbook, ['profiles', 'profile', 'prof']);
      const accessoriesSheet = this.findSheet(workbook, ['accessories', 'accessory', 'acc']);

      const profiles = profilesSheet ? this.processProfilesSheet(workbook.Sheets[profilesSheet]) : [];
      const accessories = accessoriesSheet ? this.processAccessoriesSheet(workbook.Sheets[accessoriesSheet]) : [];

      return {
        profiles,
        accessories,
        fileName,
        processedAt: new Date().toISOString(),
        totalRows: profiles.length + accessories.length
      };
    } catch (error) {
      throw new Error('Failed to parse Excel file from buffer: ' + error.message);
    }
  }
  
  /**
   * Read file as ArrayBuffer for raw storage
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
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
   * Process Excel file and extract data - handles UNLIMITED rows and columns with ALL column titles
   */
  async processExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { 
            type: 'array',
            cellDates: true, // Parse dates properly
            cellNF: false,   // Don't apply number formats
            cellText: false, // Don't convert to text
            range: undefined // Process ALL rows and columns (no range limits)
          });
          
          console.log(`📁 Processing Excel file with ${workbook.SheetNames.length} sheets:`, workbook.SheetNames);
          
          // Find profiles and accessories sheets
          const profilesSheet = this.findSheet(workbook, ['profiles', 'profile', 'prof']);
          const accessoriesSheet = this.findSheet(workbook, ['accessories', 'accessory', 'acc']);
          
          console.log(`🔍 Found sheets - Profiles: ${profilesSheet}, Accessories: ${accessoriesSheet}`);
          
          const profiles = profilesSheet ? this.processProfilesSheet(workbook.Sheets[profilesSheet]) : [];
          const accessories = accessoriesSheet ? this.processAccessoriesSheet(workbook.Sheets[accessoriesSheet]) : [];
          
          console.log(`✅ Processed UNLIMITED data - Profiles: ${profiles.length}, Accessories: ${accessories.length}`);
          console.log(`📊 Total rows processed: ${profiles.length + accessories.length} (NO LIMITS APPLIED)`);
          
          resolve({
            profiles,
            accessories,
            fileName: file.name,
            fileSize: file.size,
            processedAt: new Date().toISOString(),
            totalRows: profiles.length + accessories.length
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
   * Process profiles sheet data - imports ALL rows and ALL columns without any limits
   */
  processProfilesSheet(worksheet) {
    // Import ALL data without any row or column limits
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '', // Default value for empty cells
      raw: false, // Convert all values to strings first
      header: 1, // Use first row as headers
      range: undefined // Process ENTIRE sheet without range limits
    });
    
    if (rawData.length === 0) return [];
    
    // Get ALL headers from first row
    const headers = rawData[0];
    const dataRows = rawData.slice(1); // ALL data rows without any limits
    
    console.log(`📊 Processing ${dataRows.length} profile rows with ${headers.length} columns (ALL COLUMNS PRESERVED)`);
    console.log(`📋 Column titles detected:`, headers);
    
    return dataRows.map((row, index) => {
      const profileData = {
        // Primary fields with multiple column name variations
        code: this.cleanString(row[this.findColumnIndex(headers, ['Code', 'Item Code', 'Profile Code', 'code', 'CODE'])] || ''),
        description: this.cleanString(row[this.findColumnIndex(headers, ['Description', 'Desc', 'Name', 'description', 'DESCRIPTION'])] || ''),
        length: this.parseNumber(row[this.findColumnIndex(headers, ['Length', 'Len', 'length', 'LENGTH'])]),
        color: this.cleanString(row[this.findColumnIndex(headers, ['Color', 'Colour', 'color', 'COLOR'])] || ''),
        alloy: this.cleanString(row[this.findColumnIndex(headers, ['Alloy', 'alloy', 'ALLOY'])] || ''),
        system: this.cleanString(row[this.findColumnIndex(headers, ['System', 'system', 'SYSTEM'])] || ''),
        warehouse_no: this.cleanString(row[this.findColumnIndex(headers, ['Warehouse', 'Warehouse No', 'warehouse_no', 'WAREHOUSE'])] || ''),
        rack_no: this.cleanString(row[this.findColumnIndex(headers, ['Rack', 'Rack No', 'rack_no', 'RACK'])] || ''),
        quantity: this.parseNumber(row[this.findColumnIndex(headers, ['Quantity', 'Qty', 'quantity', 'QUANTITY'])]) || 0,
        unit: this.cleanString(row[this.findColumnIndex(headers, ['Unit', 'UOM', 'unit', 'UNIT'])] || 'pcs')
      };
      
      // Add ALL additional columns as custom fields to preserve COMPLETE data
      headers.forEach((header, colIndex) => {
        if (header && row[colIndex] !== undefined && row[colIndex] !== '') {
          const fieldName = this.sanitizeFieldName(header);
          if (!profileData.hasOwnProperty(fieldName) && !this.isStandardField(fieldName)) {
            profileData[fieldName] = this.cleanString(row[colIndex]);
          }
        }
      });
      
      return profileData;
    }).filter(item => item.code); // Only include items with codes
  }

  /**
   * Process accessories sheet data - imports ALL rows and ALL columns without any limits
   */
  processAccessoriesSheet(worksheet) {
    // Import ALL data without any row or column limits
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: '', // Default value for empty cells
      raw: false, // Convert all values to strings first
      header: 1, // Use first row as headers
      range: undefined // Process ENTIRE sheet without range limits
    });
    
    if (rawData.length === 0) return [];
    
    // Get ALL headers from first row
    const headers = rawData[0];
    const dataRows = rawData.slice(1); // ALL data rows without any limits
    
    console.log(`📦 Processing ${dataRows.length} accessory rows with ${headers.length} columns (ALL COLUMNS PRESERVED)`);
    console.log(`📋 Column titles detected:`, headers);
    
    return dataRows.map((row, index) => {
      const accessoryData = {
        // Primary fields with multiple column name variations
        code: this.cleanString(row[this.findColumnIndex(headers, ['Code', 'Item Code', 'Accessory Code', 'code', 'CODE'])] || ''),
        description: this.cleanString(row[this.findColumnIndex(headers, ['Description', 'Desc', 'Name', 'description', 'DESCRIPTION'])] || ''),
        unit: this.cleanString(row[this.findColumnIndex(headers, ['Unit', 'UOM', 'unit', 'UNIT'])] || 'pcs'),
        category: this.cleanString(row[this.findColumnIndex(headers, ['Category', 'Type', 'category', 'CATEGORY'])] || ''),
        warehouse_no: this.cleanString(row[this.findColumnIndex(headers, ['Warehouse', 'Warehouse No', 'warehouse_no', 'WAREHOUSE'])] || ''),
        rack_no: this.cleanString(row[this.findColumnIndex(headers, ['Rack', 'Rack No', 'rack_no', 'RACK'])] || ''),
        quantity: this.parseNumber(row[this.findColumnIndex(headers, ['Quantity', 'Qty', 'quantity', 'QUANTITY'])]) || 0
      };
      
      // Add ALL additional columns as custom fields to preserve COMPLETE data
      headers.forEach((header, colIndex) => {
        if (header && row[colIndex] !== undefined && row[colIndex] !== '') {
          const fieldName = this.sanitizeFieldName(header);
          if (!accessoryData.hasOwnProperty(fieldName) && !this.isStandardField(fieldName)) {
            accessoryData[fieldName] = this.cleanString(row[colIndex]);
          }
        }
      });
      
      return accessoryData;
    }).filter(item => item.code); // Only include items with codes
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
   * Find column index by multiple possible header names
   */
  findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header && header.toString().toLowerCase().trim() === name.toLowerCase()
      );
      if (index !== -1) return index;
    }
    return -1;
  }

  /**
   * Sanitize field name for database compatibility
   */
  sanitizeFieldName(fieldName) {
    return fieldName.toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Check if field is a standard database field
   */
  isStandardField(fieldName) {
    const standardFields = [
      'code', 'description', 'length', 'color', 'alloy', 'system', 
      'warehouse_no', 'rack_no', 'quantity', 'unit', 'category',
      'id', 'organization_id', 'created_at', 'updated_at'
    ];
    return standardFields.includes(fieldName);
  }

  // Removed storeDataLocally: no longer storing arrays in localStorage/sessionStorage. Only keep file URL/version if needed.

  /**
   * Publish data to Supabase database using the InventoryStateManager
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
      const profilesData = cachedData.profiles.map(item => {
        const { code, description, length, color, alloy, system, warehouse_no, rack_no, quantity, unit, ...additionalData } = item;
        return {
          code,
          description,
          length,
          color,
          alloy,
          system,
          warehouse_no,
          rack_no,
          quantity,
          unit,
          additional_data: additionalData, // Store extra columns in JSONB field
          organization_id: this.orgId,
          updated_at: new Date().toISOString()
        };
      });

      const accessoriesData = cachedData.accessories.map(item => {
        const { code, description, unit, category, warehouse_no, rack_no, quantity, ...additionalData } = item;
        return {
          code,
          description,
          unit,
          category,
          warehouse_no,
          rack_no,
          quantity,
          additional_data: additionalData, // Store extra columns in JSONB field
          organization_id: this.orgId,
          updated_at: new Date().toISOString()
        };
      });

      // Check if we have the inventory state manager available
      if (window.InventoryStateManager) {
        const inventoryManager = new window.InventoryStateManager(this.supabase, this.orgId);
        
        // Use the inventory state manager to upload the Excel file
        await inventoryManager.uploadExcelFile(
          new Blob([cachedData.rawExcelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          cachedData.fileName || 'inventory_data.xlsx',
          true // Force an update even if the data hasn't changed
        );

        // Record upload history using the inventory state
        await this.recordUploadHistory(user.id, cachedData, profilesData.length, accessoriesData.length);
        
        this.setUploadStatus('success',
          `✅ Data published successfully through Inventory State Manager! ${profilesData.length} profiles and ${accessoriesData.length} accessories are now available to all users.`
        );
      } else {
        // Fall back to the old method if inventory state manager isn't available
        console.warn('InventoryStateManager not available, falling back to direct database upload');
        
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
      }

      // No need to call broadcastDataUpdate() here as the InventoryStateManager 
      // will handle notifying all clients through Supabase Realtime

    } catch (error) {
      console.error('Database upload error:', error);
      this.setUploadStatus('error', `Failed to publish data: ${error.message}`);
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Upload data in batches to avoid Supabase limits - UNLIMITED BATCHES
   */
  async uploadInBatches(table, data, batchSize = 5000) { // Increased batch size for better performance
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
      this.setUploadStatus('uploading', `Uploading ${table}... ${progress}% (${i + batch.length}/${data.length} records - NO LIMITS)`);
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
    // This is now handled by the InventoryStateManager through Supabase Realtime
    // For backward compatibility, we'll still dispatch the local event
    window.dispatchEvent(new CustomEvent('alumilDataUpdated', {
      detail: { timestamp: new Date().toISOString() }
    }));
    
    console.log('📡 Data update broadcast event fired (Legacy method - InventoryStateManager provides real-time updates)');
  }
}

// Export for use in other scripts
window.AlumilExcelUploader = AlumilExcelUploader;