# Alumil Inventory System - Supabase Edition

## 🚀 Quick Deployment Guide

### Pre-configured Features:
✅ **Supabase Integration**: Fully configured with your project credentials  
✅ **Login System**: `login.html` ready to use  
✅ **Auto-Logout**: Logout buttons in navigation headers  
✅ **Smart Input Reading**: Automatically reads SKU/Qty/Size from page inputs  
✅ **Database Ready**: Schema deployed and admin user configured  

### Deployment Steps:

1. **Upload to your host** (Cloudflare Pages, Netlify, or your current hosting)
2. **Set your team's entry point** to `login.html`
3. **Users sign in first** before accessing other pages

### Usage Flow:

1. **Team members visit** `login.html` to sign in
2. **After login**, they can access:
   - `profile-label-printing.html` - Print profile labels
   - `acc-label-printing.html` - Print accessory labels
   - `admin.html` - Admin panel (admin users only)
3. **Print logging**: Click "Log Print" button on printing pages
4. **Reports**: Admin users can access reports via Admin panel

### Initial Data Setup:

**Option 1: CSV Import via Supabase Dashboard**
- Go to your Supabase dashboard → Table Editor
- Import to `items` table (columns: sku, name)
- Import to `warehouses` table (columns: code, name)
- Import to `racks` table (columns: warehouse_id, code)

**Option 2: Manual Entry**
- Use the print overlay to add items/warehouses/racks as needed
- Data is created automatically when logging prints

### Admin Functions:

- **View Reports**: Daily and date range print reports
- **Manage Users**: View user activity and permissions
- **Data Management**: Import/export functionality

### Troubleshooting:

- **"Nothing happens when logging"** → User not signed in. Go to `login.html`
- **"Admins only" error** → User needs admin role in `profiles` table
- **"SKU not found"** → Add items via CSV import or create during print logging

### Security Notes:

- All data operations protected by Row Level Security (RLS)
- Users can only see their own data unless admin
- Print logs and reports are admin-only
- Anonymous users cannot write data

---

**Ready to use!** Your Supabase-powered inventory system is fully configured and ready for deployment.