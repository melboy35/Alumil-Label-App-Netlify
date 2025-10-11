// Direct Excel Reader for Supabase Storage
// Option B1: Read Excel files directly from storage on client side

class DirectExcelInventory {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.cache = {
      data: null,
      timestamp: null,
      filename: null,
      checksum: null
    };
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  // Check if current user is admin
  async isAdmin() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await this.supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      return !error && data?.is_admin === true;
    } catch {
      return false;
    }
  }

  // Upload Excel file to Supabase Storage (admin only)
  async uploadExcelFile(file, filename = 'inventory.xlsx') {
    try {
      // Generate checksum for cache-busting
      const checksum = await this.generateFileChecksum(file);
      
      // Upload to storage with timestamp for cache-busting
      const timestampedName = `${Date.now()}_${filename}`;
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from("inventory")
        .upload(timestampedName, file, { 
          cacheControl: "60",
          upsert: false // Always create new file
        });

      if (uploadError) throw uploadError;

      // Record in metadata table
      const { data: fileRecord, error: dbError } = await this.supabase
        .from("inventory_files")
        .insert({
          filename: timestampedName,
          file_size: file.size,
          checksum: checksum,
          is_current: false // Will be set to true next
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Mark as current file
      await this.supabase.rpc("set_current_file", { file_id: fileRecord.id });

      // Clear cache
      this.clearCache();

      return { 
        success: true, 
        message: `File uploaded successfully: ${timestampedName}`,
        filename: timestampedName,
        size: file.size
      };
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Generate file checksum for cache-busting
  async generateFileChecksum(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get current file metadata
  async getCurrentFileInfo() {
    try {
      const { data, error } = await this.supabase.rpc("get_current_file_info");
      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Failed to get file info:', error);
      return null;
    }
  }

  // Check if cache is valid
  isCacheValid(fileInfo) {
    if (!this.cache.data || !this.cache.timestamp) return false;
    
    // Check if cache has expired
    const now = Date.now();
    if (now - this.cache.timestamp > this.cacheDuration) return false;

    // Check if file has changed
    if (fileInfo && fileInfo.checksum !== this.cache.checksum) return false;

    return true;
  }

  // Clear cache
  clearCache() {
    this.cache = {
      data: null,
      timestamp: null,
      filename: null,
      checksum: null
    };
  }

  // Load and parse Excel data
  async loadInventoryData(forceRefresh = false) {
    try {
      // Get current file info for cache-busting
      const fileInfo = await this.getCurrentFileInfo();
      if (!fileInfo) {
        throw new Error('No inventory file found. Please ask admin to upload Excel file.');
      }

      // Check cache validity
      if (!forceRefresh && this.isCacheValid(fileInfo)) {
        console.log('Using cached inventory data');
        return this.cache.data;
      }

      console.log('Loading fresh inventory data from Excel...');

      // Download Excel file from storage
      const { data: fileBlob, error: downloadError } = await this.supabase.storage
        .from("inventory")
        .download(fileInfo.filename);

      if (downloadError) throw downloadError;

      // Parse Excel file
      const inventoryData = await this.parseExcelFile(fileBlob);

      // Update cache
      this.cache = {
        data: inventoryData,
        timestamp: Date.now(),
        filename: fileInfo.filename,
        checksum: fileInfo.checksum
      };

      console.log(`Loaded ${inventoryData.length} items from Excel`);
      return inventoryData;

    } catch (error) {
      throw new Error(`Failed to load inventory: ${error.message}`);
    }
  }

  // Parse Excel file to JSON
  async parseExcelFile(fileBlob) {
    try {
      // Load XLSX library dynamically if not already loaded
      if (typeof XLSX === 'undefined') {
        await this.loadXLSXLibrary();
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Use first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      
      // Normalize and clean data
      return this.normalizeInventoryData(rawData);
      
    } catch (error) {
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  // Load XLSX library dynamically
  async loadXLSXLibrary() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="xlsx"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load XLSX library'));
      document.head.appendChild(script);
    });
  }

  // Normalize Excel data to consistent format
  normalizeInventoryData(rawData) {
    return rawData
      .map((row, index) => {
        try {
          // Handle different possible column names (case insensitive)
          const normalizedRow = {};
          Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase().trim();
            normalizedRow[lowerKey] = row[key];
          });

          return {
            sku: this.cleanString(normalizedRow.sku || normalizedRow.code || normalizedRow.id),
            name: this.cleanString(normalizedRow.name || normalizedRow.description || normalizedRow.product),
            category: this.cleanString(normalizedRow.category || normalizedRow.type || normalizedRow.group),
            qty: this.parseNumber(normalizedRow.qty || normalizedRow.quantity || normalizedRow.stock) || 0,
            cost: this.parseNumber(normalizedRow.cost || normalizedRow.costprice),
            price: this.parseNumber(normalizedRow.price || normalizedRow.sellprice || normalizedRow.saleprice),
            is_active: this.parseBoolean(normalizedRow.active || normalizedRow.is_active || normalizedRow.enabled, true),
            _rowIndex: index + 1 // For debugging
          };
        } catch (error) {
          console.warn(`Error processing row ${index + 1}:`, error);
          return null;
        }
      })
      .filter(item => item && item.sku && item.name); // Remove invalid rows
  }

  // Helper: clean string values
  cleanString(value) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str === '' ? null : str;
  }

  // Helper: parse numeric values
  parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  // Helper: parse boolean values
  parseBoolean(value, defaultValue = false) {
    if (value === null || value === undefined || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    if (['true', 'yes', '1', 'active', 'enabled'].includes(str)) return true;
    if (['false', 'no', '0', 'inactive', 'disabled'].includes(str)) return false;
    return defaultValue;
  }

  // Search and filter inventory data
  searchInventory(searchTerm = '', category = '', activeOnly = true) {
    if (!this.cache.data) {
      throw new Error('No inventory data loaded. Call loadInventoryData() first.');
    }

    return this.cache.data.filter(item => {
      // Filter by active status
      if (activeOnly && !item.is_active) return false;

      // Filter by category
      if (category && item.category !== category) return false;

      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSKU = item.sku?.toLowerCase().includes(term);
        const matchesName = item.name?.toLowerCase().includes(term);
        const matchesCategory = item.category?.toLowerCase().includes(term);
        
        if (!matchesSKU && !matchesName && !matchesCategory) return false;
      }

      return true;
    });
  }

  // Get unique categories
  getCategories() {
    if (!this.cache.data) return [];
    
    const categories = [...new Set(
      this.cache.data
        .filter(item => item.is_active && item.category)
        .map(item => item.category)
    )].sort();

    return categories.map(cat => ({
      category: cat,
      count: this.cache.data.filter(item => item.is_active && item.category === cat).length
    }));
  }

  // Get low stock items
  getLowStockItems(threshold = 5) {
    if (!this.cache.data) return [];
    
    return this.cache.data
      .filter(item => item.is_active && item.qty !== null && item.qty < threshold)
      .sort((a, b) => (a.qty || 0) - (b.qty || 0));
  }

  // Get inventory stats
  getInventoryStats() {
    if (!this.cache.data) return null;

    const activeItems = this.cache.data.filter(item => item.is_active);
    const totalValue = activeItems.reduce((sum, item) => {
      return sum + ((item.qty || 0) * (item.cost || 0));
    }, 0);

    return {
      totalItems: this.cache.data.length,
      activeItems: activeItems.length,
      totalValue: totalValue,
      categories: this.getCategories().length,
      lowStockItems: this.getLowStockItems().length,
      lastUpdated: this.cache.timestamp ? new Date(this.cache.timestamp) : null
    };
  }
}

// Usage example:
/*
// Initialize
const inventory = new DirectExcelInventory(supabase);

// Admin: Upload new Excel file
async function uploadInventory() {
  const fileInput = document.getElementById('excel-file');
  const file = fileInput.files[0];
  
  try {
    const result = await inventory.uploadExcelFile(file);
    console.log(result.message);
  } catch (error) {
    console.error('Upload failed:', error.message);
  }
}

// Load and display inventory
async function loadInventory() {
  try {
    const data = await inventory.loadInventoryData();
    displayInventoryData(data);
  } catch (error) {
    console.error('Load failed:', error.message);
  }
}

// Search inventory
function searchInventory() {
  const searchTerm = document.getElementById('search').value;
  const category = document.getElementById('category-filter').value;
  
  try {
    const results = inventory.searchInventory(searchTerm, category);
    displayInventoryData(results);
  } catch (error) {
    console.error('Search failed:', error.message);
  }
}
*/

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DirectExcelInventory;
}