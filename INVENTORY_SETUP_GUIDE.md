# Supabase Excel Inventory Management Setup Guide

This system allows admins to upload Excel files to Supabase and automatically sync inventory data with all users in real-time.

## 🏗️ Architecture Overview

1. **Excel File** → **Supabase Storage** → **Edge Function** → **PostgreSQL** → **Live Sync to All Users**
2. **Single source of truth**: One Excel file (`current.xlsx`) always overwrites the previous
3. **Admin controls**: Only admins can upload/ingest, everyone else gets read-only access
4. **Real-time sync**: Changes appear instantly across all devices

## 📋 Setup Steps

### 1. Database Schema Setup

1. Open Supabase SQL Editor
2. Run the contents of `supabase-inventory-schema.sql`
3. This creates:
   - Profiles table with admin flags
   - Inventory items table
   - Storage policies
   - Helper functions

### 2. Storage Bucket Setup

1. Go to Supabase Storage
2. Create a new bucket named `inventory`
3. Set it as **Private** (policies handle access)

### 3. Edge Function Deployment

```bash
# Initialize Supabase CLI (if not done already)
supabase init

# Create the function directory
mkdir -p supabase/functions/ingest_inventory

# Copy the function code
# Copy contents of supabase-ingest-function.ts to:
# supabase/functions/ingest_inventory/index.ts

# Deploy the function
supabase functions deploy ingest_inventory

# Set admin secret (recommended for security)
supabase secrets set ADMIN_INGEST_SECRET="your-long-random-secret-key-here"
```

### 4. Make Your Account Admin

1. Sign up/login to your app
2. In Supabase SQL Editor, run:
```sql
SELECT public.make_me_admin();
```

### 5. Excel File Format

Your Excel file should have these columns (header row):
- `sku` (required) - Product SKU/ID
- `name` (required) - Product name
- `category` (optional) - Product category
- `qty` (optional) - Quantity in stock
- `cost` (optional) - Cost price
- `price` (optional) - Selling price
- `is_active` (optional) - true/false, defaults to true

## 🔧 Integration in Your App

### HTML Admin Interface

```html
<!-- Add to your admin page -->
<div id="admin-inventory">
  <h2>Inventory Management</h2>
  
  <div class="upload-section">
    <input type="file" id="excel-file" accept=".xlsx,.xls" />
    <button onclick="uploadAndIngest()" id="ingest-btn">
      Upload & Process Inventory
    </button>
    <label>
      <input type="checkbox" id="reconcile-missing" checked />
      Mark missing items as inactive
    </label>
  </div>
  
  <div id="status" class="status"></div>
  
  <div class="inventory-stats">
    <div id="total-items">Total Items: -</div>
    <div id="active-items">Active Items: -</div>
    <div id="last-updated">Last Updated: -</div>
  </div>
</div>
```

### JavaScript Integration

```javascript
// Initialize with your Supabase client and admin secret
const inventoryManager = new InventoryManager(supabase, "your-admin-secret");

// Admin upload and ingest function
async function uploadAndIngest() {
  const fileInput = document.getElementById('excel-file');
  const reconcile = document.getElementById('reconcile-missing').checked;
  const button = document.getElementById('ingest-btn');
  
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select an Excel file');
    return;
  }

  try {
    button.disabled = true;
    button.textContent = 'Processing...';
    
    // Upload file to storage
    showStatus('Uploading file to Supabase Storage...', 'info');
    await inventoryManager.uploadInventoryFile(file);
    
    // Trigger ingestion
    showStatus('Processing inventory data...', 'info');
    const result = await inventoryManager.ingestWithSecret({ 
      reconcileMissing: reconcile 
    });
    
    showStatus(`✅ ${result.message}`, 'success');
    
    // Refresh stats
    await updateInventoryStats();
    
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Upload & Process Inventory';
  }
}

// Update inventory statistics
async function updateInventoryStats() {
  try {
    const allItems = await inventoryManager.getInventoryItems({ activeOnly: false });
    const activeItems = allItems.filter(item => item.is_active);
    
    document.getElementById('total-items').textContent = `Total Items: ${allItems.length}`;
    document.getElementById('active-items').textContent = `Active Items: ${activeItems.length}`;
    
    if (allItems.length > 0) {
      const lastUpdated = new Date(Math.max(...allItems.map(item => new Date(item.updated_at))));
      document.getElementById('last-updated').textContent = `Last Updated: ${lastUpdated.toLocaleString()}`;
    }
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}
```

### User Interface (Read-Only)

```javascript
// For non-admin users - search and display inventory
async function searchInventory() {
  const searchTerm = document.getElementById('search-input').value;
  const category = document.getElementById('category-filter').value;
  
  try {
    const items = await inventoryManager.getInventoryItems({
      activeOnly: true,
      search: searchTerm,
      category: category || null
    });
    
    displayInventoryResults(items);
  } catch (error) {
    console.error('Search failed:', error);
  }
}

// Display search results
function displayInventoryResults(items) {
  const container = document.getElementById('inventory-results');
  
  if (items.length === 0) {
    container.innerHTML = '<p>No items found</p>';
    return;
  }
  
  container.innerHTML = items.map(item => `
    <div class="inventory-card">
      <h3>${item.name}</h3>
      <p><strong>SKU:</strong> ${item.sku}</p>
      <p><strong>Category:</strong> ${item.category || 'N/A'}</p>
      <p><strong>In Stock:</strong> ${item.qty}</p>
      ${item.price ? `<p><strong>Price:</strong> $${item.price}</p>` : ''}
    </div>
  `).join('');
}
```

## 🎨 CSS Styling

```css
.status {
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
}

.status.info {
  background-color: #e3f2fd;
  color: #1976d2;
}

.status.success {
  background-color: #e8f5e8;
  color: #388e3c;
}

.status.error {
  background-color: #ffebee;
  color: #d32f2f;
}

.inventory-card {
  border: 1px solid #ddd;
  padding: 15px;
  margin: 10px 0;
  border-radius: 8px;
}

.upload-section {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.inventory-stats {
  display: flex;
  gap: 20px;
  margin: 20px 0;
}

.inventory-stats > div {
  padding: 10px;
  background: #e3f2fd;
  border-radius: 4px;
}
```

## 🔐 Security Features

- **Admin-only uploads**: Only users with `is_admin = true` can upload/ingest
- **Row Level Security**: Database policies prevent unauthorized access
- **Optional secret gate**: Edge function can require admin secret header
- **JWT validation**: Alternative to secret for logged-in admin verification

## 📊 Available Queries

```javascript
// Get all active inventory
const items = await inventoryManager.getInventoryItems();

// Search with filters
const filtered = await inventoryManager.getInventoryItems({
  search: "aluminum",
  category: "profiles",
  activeOnly: true
});

// Get categories with item counts
const categories = await inventoryManager.getCategories();

// Get low stock items (qty < 5)
const lowStock = await inventoryManager.getLowStockItems();

// Check if current user is admin
const isAdmin = await inventoryManager.isAdmin();
```

## 🚀 Workflow Summary

### Admin Workflow:
1. Prepare Excel file with correct column headers
2. Upload file through admin interface
3. Click "Upload & Process Inventory"
4. System uploads to Supabase Storage as `current.xlsx`
5. Edge function processes Excel → PostgreSQL
6. All users see updated data immediately

### User Workflow:
1. Search/browse inventory through app interface
2. Data is always live from PostgreSQL
3. No need to download/sync files
4. Real-time updates when admin uploads new data

## 🛠️ Environment Variables

Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ADMIN_INGEST_SECRET=your-admin-secret
```

## ✅ Testing Checklist

- [ ] Database schema deployed
- [ ] Storage bucket `inventory` created (private)
- [ ] Edge function deployed successfully
- [ ] Admin secret set in Supabase
- [ ] Test account marked as admin
- [ ] Excel file uploads to storage
- [ ] Ingestion processes correctly
- [ ] Non-admin users can read data
- [ ] Search and filtering work
- [ ] Real-time updates visible

## 🎯 Benefits

✅ **Single source of truth**: One Excel file drives everything  
✅ **Real-time sync**: Changes appear instantly everywhere  
✅ **Scalable**: Works with thousands of items  
✅ **Secure**: Admin controls with RLS policies  
✅ **Mobile-friendly**: Works on all devices  
✅ **Offline-capable**: Data cached locally  
✅ **Version control**: Git tracks schema changes  

You're now ready to go live with Excel-driven inventory management! 🚀