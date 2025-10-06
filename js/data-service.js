/**
 * Alumil Data Service
 * Provides centralized access to inventory data from Supabase for all users
 */

class AlumilDataService {
  constructor(supabaseClient, organizationId = '00000000-0000-0000-0000-000000000000') {
    this.supabase = supabaseClient;
    this.orgId = organizationId;
    this.cache = {
      profiles: [],
      accessories: [],
      lastFetch: null,
      cacheTimeout: 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Initialize the data service
   */
  async init() {
    // Load initial data
    await this.loadData();
    
    // Set up real-time subscriptions for data updates
    this.setupRealTimeSubscriptions();
    
    // Listen for admin data updates
    window.addEventListener('alumilDataUpdated', () => {
      this.loadData(true); // Force refresh
    });
  }

  /**
   * Get all profiles
   */
  async getProfiles(forceRefresh = false) {
    await this.ensureDataLoaded(forceRefresh);
    return this.cache.profiles;
  }

  /**
   * Get all accessories
   */
  async getAccessories(forceRefresh = false) {
    await this.ensureDataLoaded(forceRefresh);
    return this.cache.accessories;
  }

  /**
   * Search profiles by code or description
   */
  async searchProfiles(query, forceRefresh = false) {
    const profiles = await this.getProfiles(forceRefresh);
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) return profiles;
    
    return profiles.filter(item => 
      item.code?.toLowerCase().includes(searchTerm) ||
      item.description?.toLowerCase().includes(searchTerm) ||
      item.color?.toLowerCase().includes(searchTerm) ||
      item.alloy?.toLowerCase().includes(searchTerm) ||
      item.system?.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Search accessories by code or description
   */
  async searchAccessories(query, forceRefresh = false) {
    const accessories = await this.getAccessories(forceRefresh);
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) return accessories;
    
    return accessories.filter(item => 
      item.code?.toLowerCase().includes(searchTerm) ||
      item.description?.toLowerCase().includes(searchTerm) ||
      item.category?.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get profile by exact code
   */
  async getProfileByCode(code) {
    const profiles = await this.getProfiles();
    return profiles.find(item => item.code === code);
  }

  /**
   * Get accessory by exact code
   */
  async getAccessoryByCode(code) {
    const accessories = await this.getAccessories();
    return accessories.find(item => item.code === code);
  }

  /**
   * Get data statistics
   */
  async getStats() {
    const [profiles, accessories] = await Promise.all([
      this.getProfiles(),
      this.getAccessories()
    ]);

    return {
      totalProfiles: profiles.length,
      totalAccessories: accessories.length,
      totalItems: profiles.length + accessories.length,
      lastUpdated: this.cache.lastFetch,
      profilesWithWarehouse: profiles.filter(p => p.warehouse_no).length,
      accessoriesWithWarehouse: accessories.filter(a => a.warehouse_no).length
    };
  }

  /**
   * Ensure data is loaded and fresh
   */
  async ensureDataLoaded(forceRefresh = false) {
    const now = Date.now();
    const needsRefresh = forceRefresh || 
      !this.cache.lastFetch || 
      (now - this.cache.lastFetch) > this.cache.cacheTimeout;

    if (needsRefresh) {
      await this.loadData();
    }
  }

  /**
   * Load data from Supabase
   */
  async loadData(forceRefresh = false) {
    try {
      // Check if we have cached data and don't need refresh
      if (!forceRefresh && this.cache.lastFetch && 
          (Date.now() - this.cache.lastFetch) < this.cache.cacheTimeout) {
        return;
      }

      // First, try to load from localStorage for immediate display
      if (!forceRefresh) {
        this.loadFromLocalStorage();
      }

      console.log('🔄 Loading fresh data from Supabase...');

      // Fetch profiles and accessories with pagination to overcome limits - TRULY UNLIMITED
      this.cache.profiles = await this.fetchAllRecords('inventory_profiles');
      this.cache.accessories = await this.fetchAllRecords('inventory_accessories');
      this.cache.lastFetch = Date.now();

      console.log(`✅ Data loaded from database with pagination: ${this.cache.profiles.length} profiles, ${this.cache.accessories.length} accessories`);

      // Update localStorage for offline access - using session storage for large datasets
      this.saveToStorage();

      // Notify listeners of data update
      this.notifyDataUpdated();

    } catch (error) {
      console.error('Failed to load data from database:', error);
      
      // Fall back to localStorage if database fails
      this.loadFromLocalStorage();
      
      // Show user-friendly message but don't throw error - graceful degradation
      console.warn('📦 Using cached data due to database connection issue');
    }
  }
  
  /**
   * Fetch all records from a table using pagination - TRULY UNLIMITED
   */
  async fetchAllRecords(table) {
    const pageSize = 10000; // Maximum Supabase page size
    let allRecords = [];
    let page = 0;
    let hasMoreData = true;
    
    while (hasMoreData) {
      const start = page * pageSize;
      console.log(`📄 Fetching ${table} page ${page + 1} (offset: ${start}, limit: ${pageSize})...`);
      
      const { data, error, count } = await this.supabase
        .from(table)
        .select('*', { count: 'exact' })
        .eq('organization_id', this.orgId)
        .order('code')
        .range(start, start + pageSize - 1);
        
      if (error) {
        console.error(`Error fetching ${table} page ${page + 1}:`, error);
        break;
      }
      
      if (!data || data.length === 0) {
        hasMoreData = false;
      } else {
        allRecords = [...allRecords, ...data];
        console.log(`✅ Received ${data.length} records from ${table}, total so far: ${allRecords.length}`);
        
        // Check if we've received fewer records than the page size
        if (data.length < pageSize) {
          hasMoreData = false;
        } else {
          page++;
        }
      }
    }
    
    console.log(`� Total ${table} records loaded: ${allRecords.length}`);
    return allRecords;
  }

  // Removed loadFromLocalStorage: no longer loading arrays from localStorage/sessionStorage.

  // Removed saveToStorage: no longer storing arrays in localStorage/sessionStorage.

  /**
   * Set up real-time subscriptions for data updates
   */
  setupRealTimeSubscriptions() {
    // Subscribe to profiles table changes
    this.supabase
      .channel('inventory_profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory_profiles' },
        (payload) => {
          console.log('Profiles table changed:', payload);
          this.loadData(true);
        }
      )
      .subscribe();

    // Subscribe to accessories table changes
    this.supabase
      .channel('inventory_accessories_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory_accessories' },
        (payload) => {
          console.log('Accessories table changed:', payload);
          this.loadData(true);
        }
      )
      .subscribe();
  }

  /**
   * Notify listeners of data updates
   */
  notifyDataUpdated() {
    window.dispatchEvent(new CustomEvent('alumilDataLoaded', {
      detail: {
        profiles: this.cache.profiles.length,
        accessories: this.cache.accessories.length,
        timestamp: this.cache.lastFetch
      }
    }));
  }

  /**
   * Export data to Excel (for admin users)
   */
  async exportToExcel() {
    try {
      // Ensure we have fresh data
      await this.loadData(true);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add profiles sheet
      if (this.cache.profiles.length > 0) {
        const profilesSheet = XLSX.utils.json_to_sheet(this.cache.profiles);
        XLSX.utils.book_append_sheet(wb, profilesSheet, 'Profiles');
      }

      // Add accessories sheet
      if (this.cache.accessories.length > 0) {
        const accessoriesSheet = XLSX.utils.json_to_sheet(this.cache.accessories);
        XLSX.utils.book_append_sheet(wb, accessoriesSheet, 'Accessories');
      }

      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0];
      const filename = `alumil_inventory_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      return filename;
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Get data freshness status
   */
  getDataStatus() {
    const now = Date.now();
    const age = this.cache.lastFetch ? now - this.cache.lastFetch : null;
    
    return {
      isLoaded: this.cache.lastFetch !== null,
      lastFetch: this.cache.lastFetch,
      ageMinutes: age ? Math.round(age / (1000 * 60)) : null,
      isStale: age ? age > this.cache.cacheTimeout : true,
      profileCount: this.cache.profiles.length,
      accessoryCount: this.cache.accessories.length
    };
  }
}

// Export for global use
window.AlumilDataService = AlumilDataService;

// Auto-initialize global instance if Supabase client is available
document.addEventListener('DOMContentLoaded', () => {
  if (window._sbClient && !window.alumilData) {
    window.alumilData = new AlumilDataService(window._sbClient);
    window.alumilData.init();
    console.log('✅ Global AlumilDataService initialized');
    
    // Check if InventoryStateManager is available and initialize it
    if (window.InventoryStateManager) {
      console.log('🔄 InventoryStateManager detected - will use modern cache system');
      
      // Initialize the inventory state manager with the organization ID
      const orgId = window.alumilData.orgId;
      window.inventoryState = new InventoryStateManager(window._sbClient, orgId);
      
      // Initialize the inventory state (loads from cache or remote)
      window.inventoryState.init();
    } else {
      console.log('⚠️ InventoryStateManager not available - using legacy cache system');
    }
  }
});