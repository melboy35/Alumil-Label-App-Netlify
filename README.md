# Alumil Inventory System - Netlify Edition

## 🚀 Beautiful Login & Role-Based Authentication

### ✨ New Features:
✅ **Beautiful Login Page**: Professional glassmorphism design with Alumil branding  
✅ **Role-Based Authentication**: Admins → admin.html, Users → home.html  
✅ **Supabase Integration**: Fully configured with your project credentials  
✅ **Auto-Logout**: Logout buttons in navigation headers  
✅ **Smart Input Reading**: Automatically reads SKU/Qty/Size from page inputs  
✅ **Fixed Favicons**: Working favicons across all browsers  
✅ **Git + Netlify**: Continuous deployment via GitHub integration  

### Deployment:
Connected to **GitHub** → **Netlify** for automatic deployments.
Push to main branch triggers instant deployment to: `https://alumillabelprintingapp.netlify.app/`

### Usage Flow:

1. **Team members visit** `login.html` to sign in (beautiful branded login)
2. **Role-based routing**: Admins → Admin Panel, Users → Home Page
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

**Live Site**: https://alumillabelprintingapp.netlify.app/  
**Repository**: https://github.com/melboy35/Alumil-Label-App-Netlify
