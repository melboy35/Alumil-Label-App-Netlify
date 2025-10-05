// SUPABASE CONFIGURATION
// Replace these values with your actual Supabase project credentials

// Use global constants if defined, otherwise use local constants
const SUPABASE_URL = window.SUPABASE_URL || 'https://grsikgldzkqntlotawyi.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyc2lrZ2xkemtxbnRsb3Rhd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTQ0NTQsImV4cCI6MjA3NTE3MDQ1NH0.RtGvQ7vDNFNiabghTWVEzFroA4Z_fc8ZTr9p07fk_eQ';

// Initialize Supabase client
let supabaseClient = null;

// Initialize Supabase when the script loads
function initSupabase() {
  // First check if the global _sbClient exists (set by home.html)
  if (window._sbClient) {
    supabaseClient = window._sbClient;
    console.log('Supabase client reused from global _sbClient');
    return;
  }
  
  // Otherwise create a new client
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Also set the global client for consistency
    window._sbClient = supabaseClient;
    console.log('Supabase client initialized');
  } else {
    console.error('Supabase library not loaded. Make sure to include the Supabase CDN script.');
  }
}

// Helper function to get current user
async function getCurrentUser() {
  if (!supabaseClient) {
    // Try to initialize if not already done
    initSupabase();
    
    // If still not initialized
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return null;
    }
  }
  
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

// Helper function to check if user is admin
async function isAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  
  try {
    // Try first with 'role' field
    const { data: roleData, error: roleError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (!roleError && roleData?.role === 'admin') {
      return true;
    }
    
    // If that fails or returns false, try with 'is_admin' field
    const { data: isAdminData, error: isAdminError } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
      
    if (!isAdminError && isAdminData?.is_admin === true) {
      return true;
    }
    
    // If both checks fail, log error and return false
    if (roleError && isAdminError) {
      console.error('Error checking admin status:', roleError, isAdminError);
    }
    
    return false;
  } catch (err) {
    console.error('Exception checking admin status:', err);
    return false;
  }
}

// Helper function to get user profile
async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  if (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
  
  return data;
}

// Authentication functions
async function signUp(email, password, username) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username
      }
    }
  });
  
  if (error) {
    console.error('Sign up error:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error('Sign in error:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function signOut() {
  // Use authHelper for logout if available
  if (window.authHelper) {
    return window.authHelper.logout();
  }
  
  // Fallback to direct Supabase call
  const { error } = await supabaseClient.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error);
    return { success: false, error };
  }
  
  // Redirect to login page
  window.location.href = 'login.html';
  
  return { success: true };
}

// Database query helpers
async function getItems() {
  const { data, error } = await supabaseClient
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching items:', error);
    return [];
  }
  
  return data || [];
}

async function getWarehouses() {
  const { data, error } = await supabaseClient
    .from('warehouses')
    .select('*')
    .order('code');
    
  if (error) {
    console.error('Error fetching warehouses:', error);
    return [];
  }
  
  return data || [];
}

async function getRacks(warehouseId = null) {
  let query = supabaseClient
    .from('racks')
    .select('*, warehouses(code, name)');
    
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }
  
  const { data, error } = await query.order('code');
    
  if (error) {
    console.error('Error fetching racks:', error);
    return [];
  }
  
  return data || [];
}

async function getItemLocations() {
  const { data, error } = await supabaseClient
    .from('item_locations')
    .select(`
      *,
      items(sku, name),
      warehouses(code, name),
      racks(code),
      profiles(username)
    `)
    .eq('active', true)
    .order('added_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching item locations:', error);
    return [];
  }
  
  return data || [];
}

async function addItem(sku, name) {
  const { data, error } = await supabaseClient
    .from('items')
    .insert({ sku, name })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding item:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function addWarehouse(code, name) {
  const { data, error } = await supabaseClient
    .from('warehouses')
    .insert({ code, name })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding warehouse:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function addRack(warehouseId, code) {
  const { data, error } = await supabaseClient
    .from('racks')
    .insert({ warehouse_id: warehouseId, code })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding rack:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function addItemLocation(itemId, warehouseId, rackId = null, note = '') {
  const { data, error } = await supabaseClient
    .from('item_locations')
    .insert({
      item_id: itemId,
      warehouse_id: warehouseId,
      rack_id: rackId,
      note: note
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error adding item location:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function logPrint(itemId, labelQty, labelSize, warehouseId, rackId = null) {
  const { data, error } = await supabaseClient
    .from('print_logs')
    .insert({
      item_id: itemId,
      label_qty: labelQty,
      label_size: labelSize,
      warehouse_id: warehouseId,
      rack_id: rackId
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error logging print:', error);
    return { success: false, error };
  }
  
  return { success: true, data };
}

async function getPrintReports(startDate = null, endDate = null) {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    console.error('Admin access required for reports');
    return [];
  }
  
  const { data, error } = await supabaseClient
    .rpc('get_report_prints_guarded', {
      start_date: startDate,
      end_date: endDate
    });
    
  if (error) {
    console.error('Error fetching print reports:', error);
    return [];
  }
  
  return data || [];
}

// Initialize Supabase when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if authHelper exists first
  if (window.authHelper && window.authHelper.supabase) {
    // Use the supabase client from authHelper
    supabaseClient = window.authHelper.supabase;
    window._sbClient = supabaseClient;
    console.log('✅ Supabase client reused from authHelper');
  } else {
    // Initialize our own if authHelper is not available
    initSupabase();
  }
});

// Also try to initialize immediately in case the DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    if (!supabaseClient) {
      initSupabase();
    }
  }, 0);
}

// Helper function to auto-read SKU/Qty/Size from page inputs
function autoReadPageInputs() {
  const result = {
    sku: '',
    quantity: '',
    size: ''
  };
  
  // Common SKU input selectors
  const skuSelectors = [
    '#sku', '#item-sku', '#barcode', '#item-code',
    'input[name="sku"]', 'input[name="barcode"]', 'input[name="item_code"]',
    'input[placeholder*="SKU"]', 'input[placeholder*="Code"]', 'input[placeholder*="Barcode"]'
  ];
  
  // Common quantity input selectors
  const qtySelectors = [
    '#quantity', '#qty', '#amount', '#count',
    'input[name="quantity"]', 'input[name="qty"]', 'input[name="amount"]',
    'input[placeholder*="Quantity"]', 'input[placeholder*="Qty"]', 'input[placeholder*="Amount"]'
  ];
  
  // Common size input selectors
  const sizeSelectors = [
    '#size', '#label-size', '#label_size',
    'input[name="size"]', 'input[name="label_size"]',
    'select[name="size"]', 'select[name="label_size"]',
    'input[placeholder*="Size"]', 'select[placeholder*="Size"]'
  ];
  
  // Try to find and read SKU
  for (const selector of skuSelectors) {
    const element = document.querySelector(selector);
    if (element && element.value && element.value.trim()) {
      result.sku = element.value.trim();
      break;
    }
  }
  
  // Try to find and read quantity
  for (const selector of qtySelectors) {
    const element = document.querySelector(selector);
    if (element && element.value && element.value.trim()) {
      result.quantity = element.value.trim();
      break;
    }
  }
  
  // Try to find and read size
  for (const selector of sizeSelectors) {
    const element = document.querySelector(selector);
    if (element && element.value && element.value.trim()) {
      result.size = element.value.trim();
      break;
    }
  }
  
  return result;
}

// Export functions for global use
window.SupabaseAPI = {
  getCurrentUser,
  isAdmin,
  getUserProfile,
  signUp,
  signIn,
  signOut,
  getItems,
  getWarehouses,
  getRacks,
  getItemLocations,
  addItem,
  addWarehouse,
  addRack,
  addItemLocation,
  logPrint,
  getPrintReports,
  autoReadPageInputs
};