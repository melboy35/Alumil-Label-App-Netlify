/**
 * Alumil Inventory State Manager
 * Implements a robust caching and synchronization system for Excel files
 * using Supabase storage, realtime subscriptions, and IndexedDB
 */

class InventoryStateManager {
  constructor(supabaseClient, organizationId = '00000000-0000-0000-0000-000000000000') {
    this.supabase = supabaseClient;
    this.orgId = organizationId;
    this.isInitialized = false;
    this.currentState = null;
    this.db = null;
    this.listeners = [];
    this.BUCKET_NAME = 'inventory';
  }

  /**
   * Initialize the inventory state manager
   * Sets up IndexedDB and Supabase realtime subscription
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      // Initialize IndexedDB
      await this.initIndexedDB();
      
      // Set up realtime subscription
      await this.setupRealtimeSubscription();
      
      // Load initial state
      await this.loadState();
      
      this.isInitialized = true;
      console.log('✅ InventoryStateManager initialized');
    } catch (error) {
      console.error('Failed to initialize InventoryStateManager:', error);
      throw error;
    }
  }
  
  /**
   * Initialize IndexedDB with Dexie
   */
  async initIndexedDB() {
    try {
      // Make sure Dexie is loaded
      if (typeof Dexie === 'undefined') {
        console.warn('Dexie not found, loading from CDN...');
        await this.loadDexieScript();
      }
      
      // Initialize database
      this.db = new Dexie('inventory_cache');
      this.db.version(1).stores({
        meta: 'key',             // { key: 'org123', version: 3, path: '...', updatedAt: '...' }
        profiles: '++id, code',  // entire rows
        accessories: '++id, code' // entire rows
      });
      
      console.log('✅ IndexedDB initialized');
    } catch (error) {
      console.error('IndexedDB initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Load Dexie script if not already available
   */
  loadDexieScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Dexie script'));
      document.head.appendChild(script);
    });
  }
  
  /**
   * Set up Supabase realtime subscription to inventory_state table
   */
  async setupRealtimeSubscription() {
    try {
      this.channel = this.supabase
        .channel(`public:inventory_state:org:${this.orgId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'inventory_state',
          filter: `organization_id=eq.${this.orgId}`
        }, async (payload) => {
          console.log('🔄 Inventory state changed:', payload);
          const newState = payload.new;
          
          if (!newState) return;
          
          // Update our cached state
          this.currentState = newState;
          
          // If admin clicked "Clear cache"
          if (newState.invalidate_at) {
            await this.clearCache();
            return;
          }
          
          // If version bumped, check and update
          const cachedMeta = await this.db.meta.get(this.orgId);
          
          if (!cachedMeta || cachedMeta.version !== newState.version) {
            console.log(`🔄 Version changed: ${cachedMeta?.version || 'none'} -> ${newState.version}`);
            await this.refreshInventoryData();
          }
        })
        .subscribe();
      
      console.log('✅ Realtime subscription set up');
    } catch (error) {
      console.error('Failed to set up realtime subscription:', error);
      throw error;
    }
  }
  
  /**
   * Load current inventory state from Supabase
   */
  async loadState() {
    try {
      // First try cache
      const cachedMeta = await this.db.meta.get(this.orgId);
      
      // Get current state from Supabase
      const { data: state, error } = await this.supabase
        .from('inventory_state')
        .select('storage_path, version, invalidate_at, updated_at')
        .eq('organization_id', this.orgId)
        .single();
      
      if (error) {
        console.warn('Could not fetch inventory state:', error);
        return;
      }
      
      this.currentState = state;
      console.log('📊 Current inventory state:', state);
      
      // Check if we need to refresh data
      const cacheInvalid = cachedMeta && state.invalidate_at && 
        new Date(state.invalidate_at) > new Date(cachedMeta.updatedAt);
      
      const needsRefresh = !cachedMeta || 
        cacheInvalid || 
        (cachedMeta.version !== state.version);
      
      if (needsRefresh && state.storage_path) {
        console.log('🔄 Cache needs refresh, downloading new data...');
        await this.refreshInventoryData();
      } else {
        console.log('✅ Using cached data version', cachedMeta?.version);
        
        // Load data from IndexedDB into memory store
        await this.loadFromCache();
      }
    } catch (error) {
      console.error('Failed to load inventory state:', error);
      throw error;
    }
  }
  
  /**
   * Refresh inventory data by downloading from storage and updating cache
   */
  async refreshInventoryData() {
    try {
      if (!this.currentState?.storage_path) {
        console.warn('No storage path available, cannot refresh data');
        return;
      }
      
      // Get signed URL
      const signedUrl = await this.getSignedUrl(this.currentState.storage_path);
      
      // Download and parse file
      const buf = await this.downloadArrayBuffer(signedUrl);
      const { profiles, accessories } = this.parseExcel(buf);
      
      // Update memory store
      window.InventoryStore = {
        profiles: profiles,
        accessories: accessories,
        version: this.currentState.version
      };
      
      // Save to IndexedDB
      await this.cacheInventory(this.orgId, this.currentState.version, 
        this.currentState.storage_path, profiles, accessories);
      
      // Notify listeners
      this.notifyDataUpdated();
      
      console.log(`✅ Data refreshed (version ${this.currentState.version}): ${profiles.length} profiles, ${accessories.length} accessories`);
    } catch (error) {
      console.error('Failed to refresh inventory data:', error);
      throw error;
    }
  }
  
  /**
   * Get signed URL for a storage path
   */
  async getSignedUrl(path) {
    const { data, error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(path, 60 * 60 * 24); // 24h
      
    if (error) throw error;
    return data.signedUrl;
  }
  
  /**
   * Download file as ArrayBuffer
   */
  async downloadArrayBuffer(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Download failed');
    return await res.arrayBuffer();
  }
  
  /**
   * Parse Excel file
   */
  parseExcel(buf) {
    const wb = XLSX.read(buf, { type: 'array' });
    const opts = { defval: '', raw: true };
    
    const profiles = XLSX.utils.sheet_to_json(
      wb.Sheets['Profiles'] ?? wb.Sheets['Profile'] ?? wb.Sheets[wb.SheetNames[0]], opts);
      
    const accessories = XLSX.utils.sheet_to_json(
      wb.Sheets['Accessories'] ?? wb.Sheets['Accessory'] ?? wb.Sheets[wb.SheetNames[1]], opts);
      
    return { profiles, accessories };
  }
  
  /**
   * Save inventory data to IndexedDB
   */
  async cacheInventory(orgId, version, path, profiles, accessories) {
    await this.db.transaction('rw', this.db.meta, this.db.profiles, this.db.accessories, async () => {
      await this.db.profiles.clear();
      await this.db.accessories.clear();
      
      if (profiles.length) await this.db.profiles.bulkAdd(profiles);
      if (accessories.length) await this.db.accessories.bulkAdd(accessories);
      
      await this.db.meta.put({
        key: orgId,
        version,
        path,
        updatedAt: new Date().toISOString()
      });
    });
  }
  
  /**
   * Load data from IndexedDB cache
   */
  async loadFromCache() {
    const meta = await this.db.meta.get(this.orgId);
    if (!meta) return null;
    
    const [profiles, accessories] = await Promise.all([
      this.db.profiles.toArray(),
      this.db.accessories.toArray()
    ]);
    
    // Set data in memory store
    window.InventoryStore = {
      profiles: profiles,
      accessories: accessories,
      version: meta.version
    };
    
    // Notify listeners
    this.notifyDataUpdated();
    
    console.log(`📦 Loaded from cache: ${profiles.length} profiles, ${accessories.length} accessories (version ${meta.version})`);
    
    return meta;
  }
  
  /**
   * Clear cache (when admin clicks "Clear cache" or when server sends invalidate signal)
   */
  async clearCache() {
    try {
      await this.db.transaction('rw', this.db.meta, this.db.profiles, this.db.accessories, async () => {
        await this.db.profiles.clear();
        await this.db.accessories.clear();
        await this.db.meta.delete(this.orgId);
      });
      
      // Clear memory store too
      window.InventoryStore = {
        profiles: [],
        accessories: [],
        version: null
      };
      
      // Notify listeners
      this.notifyDataUpdated();
      
      console.log('🧹 Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }
  
  /**
   * Add a listener for data updates
   */
  addDataListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }
  
  /**
   * Remove a listener
   */
  removeDataListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }
  
  /**
   * Notify all listeners of data updates
   */
  notifyDataUpdated() {
    const data = window.InventoryStore || { profiles: [], accessories: [], version: null };
    
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (error) {
        console.warn('Error in data update listener:', error);
      }
    }
    
    // Also dispatch a DOM event for broader component integration
    window.dispatchEvent(new CustomEvent('inventoryDataUpdated', {
      detail: {
        profiles: data.profiles.length,
        accessories: data.accessories.length,
        version: data.version,
        timestamp: Date.now()
      }
    }));
  }
  
  /**
   * Admin: Upload a file to storage and update inventory state
   */
  async uploadAndPublish(file) {
    if (!file) throw new Error('No file provided');
    
    try {
      // 1. Upload to private bucket
      const filePath = `${this.orgId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      console.log(`📤 File uploaded to: ${filePath}`);
      
      // 2. Update state with RPC (atomic version bump)
      const { error: rpcError } = await this.supabase.rpc(
        'bump_inventory_version', 
        { org: this.orgId, path: filePath }
      );
      
      if (rpcError) throw rpcError;
      
      console.log('🔢 Version bumped successfully');
      
      // Return the path for reference
      return filePath;
    } catch (error) {
      console.error('Upload and publish failed:', error);
      throw error;
    }
  }
  
  /**
   * Admin: Clear cache for all users by updating invalidate_at timestamp
   */
  async triggerCacheClear() {
    try {
      const { error } = await this.supabase
        .from('inventory_state')
        .update({ invalidate_at: new Date().toISOString() })
        .eq('organization_id', this.orgId);
        
      if (error) throw error;
      
      console.log('🧹 Cache invalidation triggered for all users');
      
      // Clear our own cache immediately
      await this.clearCache();
      
      return true;
    } catch (error) {
      console.error('Failed to trigger cache clear:', error);
      throw error;
    }
  }
  
  /**
   * Get current inventory state
   */
  getCurrentState() {
    return this.currentState;
  }
  
  /**
   * Get cached data counts
   */
  async getCachedDataCounts() {
    try {
      const [profiles, accessories] = await Promise.all([
        this.db.profiles.count(),
        this.db.accessories.count()
      ]);
      
      const meta = await this.db.meta.get(this.orgId);
      
      return {
        profiles,
        accessories,
        total: profiles + accessories,
        version: meta?.version || null,
        cacheDate: meta?.updatedAt || null
      };
    } catch (error) {
      console.error('Failed to get cache counts:', error);
      return { profiles: 0, accessories: 0, total: 0, version: null, cacheDate: null };
    }
  }
  
  /**
   * Search profiles in cached data
   */
  async searchProfiles(query) {
    if (!query || query.trim() === '') {
      return this.db.profiles.toArray();
    }
    
    const searchTerm = query.toLowerCase().trim();
    const profiles = await this.db.profiles.toArray();
    
    return profiles.filter(item => 
      (item.code && item.code.toString().toLowerCase().includes(searchTerm)) ||
      (item.description && item.description.toString().toLowerCase().includes(searchTerm)) ||
      (item.warehouse_no && item.warehouse_no.toString().toLowerCase().includes(searchTerm)) ||
      (item.rack_no && item.rack_no.toString().toLowerCase().includes(searchTerm))
    );
  }
  
  /**
   * Search accessories in cached data
   */
  async searchAccessories(query) {
    if (!query || query.trim() === '') {
      return this.db.accessories.toArray();
    }
    
    const searchTerm = query.toLowerCase().trim();
    const accessories = await this.db.accessories.toArray();
    
    return accessories.filter(item => 
      (item.code && item.code.toString().toLowerCase().includes(searchTerm)) ||
      (item.description && item.description.toString().toLowerCase().includes(searchTerm)) ||
      (item.warehouse_no && item.warehouse_no.toString().toLowerCase().includes(searchTerm)) ||
      (item.rack_no && item.rack_no.toString().toLowerCase().includes(searchTerm))
    );
  }
}

// Create global instance
window.InventoryStateManager = InventoryStateManager;

// Initialize global in-memory store
window.InventoryStore = {
  profiles: [],
  accessories: [],
  version: null
};

// Auto-initialize when DOM is ready and Supabase client is available
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Dexie to load if it's not already loaded
  const checkAndInitialize = () => {
    if (window._sbClient) {
      if (typeof Dexie !== 'undefined') {
        window.inventoryState = new InventoryStateManager(window._sbClient, window.ORG_ID);
        window.inventoryState.init().catch(err => console.error('Failed to initialize InventoryStateManager:', err));
      } else {
        // Load Dexie and try again
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js';
        script.onload = () => {
          window.inventoryState = new InventoryStateManager(window._sbClient, window.ORG_ID);
          window.inventoryState.init().catch(err => console.error('Failed to initialize InventoryStateManager:', err));
        };
        document.head.appendChild(script);
      }
    } else {
      // Supabase client not available yet, retry later
      setTimeout(checkAndInitialize, 500);
    }
  };
  
  checkAndInitialize();
});