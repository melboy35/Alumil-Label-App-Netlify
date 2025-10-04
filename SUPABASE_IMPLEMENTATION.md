# Alumil Inventory System - Supabase Live Sync Implementation

This directory contains the master files for implementing real-time data synchronization using Supabase.

## Files Overview

### 1. `supabase-schema.sql` (Multi-tenant with org_id)
- Full schema with organizations and RLS
- For multi-tenant setups

### 2. `supabase-schema-simple.sql` (Single-tenant, no org_id)
- Simplified schema without organizations
- Use this if you get "column org_id does not exist" error

### 3. `supabase-migration.sql`
- Migration script to add org_id to existing tables
- Run this if you have existing tables without org_id

### 4. Admin Sync Scripts
- `js/supabase-admin-sync.js` - Full version with org_id
- `js/supabase-admin-sync-simple.js` - Simple version without org_id

### 5. Consumer Sync Scripts  
- `js/supabase-consumer-sync.js` - Full version with org_id
- `js/supabase-consumer-sync-simple.js` - Simple version without org_id

## Quick Fix for "org_id does not exist" Error

If you get the error `column "org_id" does not exist`, you have two options:

### Option 1: Use Simple Schema (Recommended for single-tenant)
1. Run `supabase-schema-simple.sql` in your Supabase SQL editor
2. Use `js/supabase-admin-sync-simple.js` and `js/supabase-consumer-sync-simple.js`

### Option 2: Migrate Existing Tables
1. Run `supabase-migration.sql` in your Supabase SQL editor  
2. Use the full versions with org_id support

## Setup Instructions

### 1. Supabase Configuration
1. Create a new Supabase project or use existing
2. Run the SQL from `supabase-schema.sql` in your Supabase SQL editor
3. Get your project URL and anon key from Supabase dashboard
4. Replace placeholders in both JS files:
   - `YOUR_PROJECT.supabase.co` → your actual Supabase URL
   - `YOUR_PUBLIC_ANON_KEY` → your actual anon key

### 2. Admin Implementation (admin.html)
```html
<!-- Add to your admin.html head section -->
<script src="js/supabase-admin-sync.js"></script>

<!-- In your Excel processing code, after parsing: -->
<script>
try {
  await makeLive(profiles, accessories);
  showMessage('Data uploaded and synced to all devices!');
} catch (error) {
  console.error('Sync failed:', error);
  showMessage('Upload completed locally, but cloud sync failed.');
}
</script>
```

### 3. Consumer Implementation
```html
<!-- Add to consumer pages (profile-label-printing.html, etc.) -->
<script src="js/supabase-consumer-sync.js"></script>

<!-- In your DOMContentLoaded event: -->
<script>
document.addEventListener('DOMContentLoaded', async () => {
  await initializeLiveData();
  
  // Your existing code continues to work
  const data = JSON.parse(localStorage.getItem('excelCache') || '{}');
  // ... rest of your initialization
});
</script>
```

## Features

- **Real-time Sync**: Changes propagate instantly to all connected devices
- **Offline Support**: Falls back to local cache when network unavailable
- **Progress Tracking**: Shows upload progress for large datasets
- **Version Control**: Tracks data versions for efficient updates
- **Security**: Row Level Security ensures data isolation
- **Backward Compatibility**: Existing code continues to work unchanged

## Data Import Options

### Option 1: Use Normalized JSON Files
The attached `Profile_normalized.json` and `Accessories_normalized.json` files can be imported directly:

1. Use Supabase Table Editor → Import
2. Upload the normalized JSON files
3. Set upsert keys to (org_id, code)

### Option 2: Automatic Excel Processing
Your existing Excel upload functionality will automatically sync to Supabase when you integrate the admin sync script.

## Testing

1. Upload data via admin panel on one device
2. Open consumer pages on other devices
3. Verify data appears instantly
4. Test offline functionality by disconnecting network

## Notes

- Default organization ID: `00000000-0000-0000-0000-000000000000`
- For multi-tenant setup, implement org_id resolution from user JWT
- Consider rate limiting for high-frequency updates
- Monitor Supabase usage and upgrade plan if needed