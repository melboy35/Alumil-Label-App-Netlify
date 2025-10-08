/**
 * Supabase Usage Example
 * 
 * This file demonstrates how to use the Supabase client in your application
 */

// Example usage in your HTML pages:
/*
<!-- Include the Supabase CDN -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Include your config -->
<script src="config/config.js"></script>

<!-- Include the Supabase client module -->
<script src="js/supabase-client.js"></script>

<script>
// Now you can use the Supabase client
async function exampleUsage() {
  try {
    // Get the client instance
    const supabase = window.SupabaseClient;
    
    // Query data from a table
    const { data, error } = await supabase.from('your_table').select('*');
    if (error) throw error;
    
    console.log('Data:', data);
    
    // Get current user
    const user = await supabase.getCurrentUser();
    console.log('Current user:', user);
    
    // Insert data
    const { data: newData, error: insertError } = await supabase
      .from('your_table')
      .insert([{ name: 'Test', value: 123 }]);
    
    if (insertError) throw insertError;
    console.log('Inserted:', newData);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the example
exampleUsage();
</script>
*/

// For direct JavaScript usage:
async function useSupabaseClient() {
  try {
    // Wait for the client to be ready
    const client = await window.SupabaseClient.getClient();
    
    // Example: Query inventory data
    const { data: inventory, error } = await window.SupabaseClient.from('inventory')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching inventory:', error);
      return;
    }
    
    console.log('Inventory data:', inventory);
    
    // Example: Authentication
    const user = await window.SupabaseClient.getCurrentUser();
    if (user) {
      console.log('User is logged in:', user.email);
    } else {
      console.log('User is not logged in');
    }
    
    // Example: Real-time subscription
    const subscription = await window.SupabaseClient.subscribe('inventory', (payload) => {
      console.log('Real-time update:', payload);
    });
    
    // Don't forget to unsubscribe when done
    // subscription.unsubscribe();
    
  } catch (error) {
    console.error('Error using Supabase client:', error);
  }
}

// Alternative: If you prefer the ES6 module style syntax
// You can create a wrapper function:
async function createSupabaseClient() {
  const client = await window.SupabaseClient.getClient();
  return {
    // Mimic your original code structure
    from: (table) => client.from(table),
    auth: client.auth,
    storage: client.storage,
    // Add any other methods you need
  };
}

// Usage example:
async function useES6Style() {
  const supabase = await createSupabaseClient();
  
  // Now you can use it similar to your original code:
  const { data, error } = await supabase.from('inventory').select('*');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Data:', data);
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { useSupabaseClient, createSupabaseClient };
}