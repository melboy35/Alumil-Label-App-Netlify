# 🗄️ Database Setup Instructions

Follow these steps to set up the required database tables in Supabase:

## Step 1: Access Supabase Dashboard
1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project: `grsikgldzkqntlotawyi` (or your project name)

## Step 2: Open SQL Editor
1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"** to create a new SQL script

## Step 3: Run Database Schema
1. Copy the entire contents of `database-schema.sql` file
2. Paste it into the SQL Editor
3. Click **"Run"** button to execute the script

## Step 4: Verify Tables Created
After running the script, you should see these tables created:
- `profiles` (user management)
- `organizations` (organization data)
- `inventory_profiles` (aluminum profiles)
- `inventory_accessories` (accessories)
- `data_uploads` (upload history)

## Step 5: Set Up Admin User
1. Go to **Authentication > Users** in Supabase dashboard
2. Find your user account
3. Go to **Database > Table Editor > profiles**
4. Find your profile and set `is_admin` to `true`

## Step 6: Test the System
1. Return to the admin panel
2. Try uploading an Excel file
3. Click "Publish to Database"
4. Should work without errors

## 🔧 Troubleshooting

### Error: "Could not find the table"
- The database schema hasn't been run yet
- Follow Steps 1-3 above

### Error: "Permission denied"
- Check that RLS policies are properly set up
- Ensure your user is authenticated
- Verify admin status in profiles table

### Error: "Connection failed"
- Check your Supabase URL and API key
- Ensure Supabase project is active
- Check browser console for detailed errors

## 📊 Excel File Format

Your Excel file should have these sheets:

### Profiles Sheet:
- Code (required)
- Description
- Length
- Color
- Alloy
- System
- Warehouse No
- Rack No
- Quantity
- Unit

### Accessories Sheet:
- Code (required)
- Description
- Unit
- Category
- Warehouse No
- Rack No
- Quantity

## 🚀 After Setup

Once the database is set up:
1. Upload Excel files will work properly
2. Data will be available to all users immediately
3. Real-time updates across all devices
4. Search and print functions will access live data

Need help? Check the browser console (F12) for detailed error messages.