// Client-side JavaScript for Excel inventory management
// Include this in your admin pages

class InventoryManager {
  constructor(supabaseClient, adminSecret = null) {
    this.supabase = supabaseClient;
    this.adminSecret = adminSecret;
  }

  // Upload Excel file to Supabase Storage
  async uploadInventoryFile(file) {
    try {
      const { error } = await this.supabase.storage
        .from("inventory")
        .upload("current.xlsx", file, { 
          upsert: true, 
          cacheControl: "60" 
        });
      
      if (error) throw error;
      return { success: true, message: "File uploaded successfully" };
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Trigger ingestion using admin secret
  async ingestWithSecret({ reconcileMissing = false } = {}) {
    if (!this.adminSecret) {
      throw new Error("Admin secret not configured");
    }

    try {
      const response = await fetch(`${this.supabase.supabaseUrl}/functions/v1/ingest_inventory`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-admin-secret": this.adminSecret 
        },
        body: JSON.stringify({ 
          path: "current.xlsx", 
          reconcileMissing 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }
  }

  // Trigger ingestion using JWT (requires admin user to be logged in)
  async ingestWithJWT({ reconcileMissing = false } = {}) {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${this.supabase.supabaseUrl}/functions/v1/ingest_inventory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          path: "current.xlsx", 
          reconcileMissing 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`JWT Ingestion failed: ${error.message}`);
    }
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

  // Make current user admin (one-time setup)
  async makeCurrentUserAdmin() {
    try {
      const { error } = await this.supabase.rpc("make_me_admin");
      if (error) throw error;
      return { success: true, message: "User marked as admin" };
    } catch (error) {
      throw new Error(`Failed to set admin: ${error.message}`);
    }
  }

  // Get all inventory items
  async getInventoryItems({ activeOnly = true, category = null, search = null } = {}) {
    try {
      const { data, error } = await this.supabase.rpc("search_inventory", {
        search_term: search,
        category_filter: category,
        active_only: activeOnly
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }
  }

  // Get categories
  async getCategories() {
    try {
      const { data, error } = await this.supabase.rpc("get_categories");
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
  }

  // Get low stock items
  async getLowStockItems() {
    try {
      const { data, error } = await this.supabase
        .from("low_stock_items")
        .select("*");
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to fetch low stock items: ${error.message}`);
    }
  }
}

// Usage example for admin interface:
/*
// Initialize with your Supabase client
const inventoryManager = new InventoryManager(supabase, "your-admin-secret");

// Admin workflow
async function adminUploadAndIngest() {
  const fileInput = document.getElementById('excel-file');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select an Excel file');
    return;
  }

  try {
    // Step 1: Upload file
    showStatus('Uploading file...');
    await inventoryManager.uploadInventoryFile(file);
    
    // Step 2: Trigger ingestion
    showStatus('Processing inventory data...');
    const result = await inventoryManager.ingestWithSecret({ reconcileMissing: true });
    
    showStatus(`Success! Processed ${result.rows} items.`);
    
    // Step 3: Refresh inventory display
    await refreshInventoryDisplay();
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

// Non-admin usage (read inventory)
async function loadInventory() {
  try {
    const items = await inventoryManager.getInventoryItems({
      activeOnly: true,
      search: document.getElementById('search').value
    });
    
    displayInventoryItems(items);
  } catch (error) {
    console.error('Failed to load inventory:', error);
  }
}
*/

// Helper functions for DOM manipulation
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
}

function displayInventoryItems(items) {
  const container = document.getElementById('inventory-list');
  if (!container) return;

  container.innerHTML = items.map(item => `
    <div class="inventory-item">
      <h3>${item.name} (${item.sku})</h3>
      <p>Category: ${item.category || 'N/A'}</p>
      <p>Quantity: ${item.qty}</p>
      <p>Cost: ${item.cost ? '$' + item.cost : 'N/A'}</p>
      <p>Price: ${item.price ? '$' + item.price : 'N/A'}</p>
    </div>
  `).join('');
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InventoryManager;
}