# 🚀 Alumil Label App - Complete Setup Guide

Welcome to the Alumil Label App deployment guide! This comprehensive guide will help you deploy the app with full Microsoft Graph API SharePoint integration.

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ **Hosting Platform Account** (Netlify, Vercel, or Azure Static Web Apps)
- ✅ **Supabase Account** (for database)
- ✅ **Azure AD Access** (for SharePoint integration)
- ✅ **SharePoint Site** (with inventory Excel file)
- ✅ **Domain Name** (optional, for custom domain)

## 🗄️ Step 1: Database Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new organization (if needed)
4. Create new project:
   - **Name**: `alumil-label-app`
   - **Database Password**: Create strong password
   - **Region**: Choose closest to your users

### 1.2 Import Database Schema

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Create new query
4. Copy content from `database/schema.sql`
5. Execute the query
6. Verify tables are created in **Table Editor**

### 1.3 Configure Authentication

1. Go to **Authentication** > **Settings**
2. Configure **Site URL**: `https://your-domain.com`
3. Add **Redirect URLs**:
   ```
   https://your-domain.com
   https://your-domain.com/admin.html
   https://your-domain.com/home.html
   ```
4. Enable **Email Provider**
5. Configure **Email Templates** (optional)

### 1.4 Get API Credentials

1. Go to **Settings** > **API**
2. Copy:
   - **Project URL** (`https://xxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## 🔐 Step 2: Azure AD Setup (SharePoint Integration)

### 2.1 Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory**
3. Select **App registrations**
4. Click **New registration**
5. Fill details:
   - **Name**: `Alumil Inventory App`
   - **Account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: 
     - Type: `Single-page application (SPA)`
     - URL: `https://your-domain.com`

### 2.2 Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `Sites.Read.All`
   - `Files.Read.All`
   - `Files.ReadWrite.All`
6. Click **Grant admin consent for [Organization]**

### 2.3 Get Client ID

1. Go to **Overview** tab
2. Copy **Application (client) ID**
3. Save this for configuration

## ⚙️ Step 3: Application Configuration

### 3.1 Configure Application Settings

1. Copy `config/config.template.js` to `config/config.js`
2. Update the configuration:

```javascript
// Supabase Configuration
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_KEY = 'your-supabase-anon-key';

// Azure AD Configuration
window.GraphAPIConfig = {
  clientId: 'your-azure-client-id',
  sharePoint: {
    baseUrl: 'https://your-tenant.sharepoint.com',
    sitePath: '/sites/YourSite',
    fileName: 'Inventory Data (masterfile).xlsx'
  }
};
```

### 3.2 Update Main Configuration Files

1. **Update `js/graph-api-config.js`**:
   ```javascript
   clientId: 'your-actual-azure-client-id'
   ```

2. **Verify SharePoint URL** in admin.html:
   - Check the SharePoint URL in the existing configuration
   - Update if your SharePoint site is different

## 🌐 Step 4: Deployment

### Option A: Deploy to Netlify

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial deployment"
   git remote add origin https://github.com/yourusername/alumil-label-app.git
   git push -u origin main
   ```

2. **Deploy on Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" > "Import from Git"
   - Select your repository
   - Build settings:
     - **Build command**: (leave empty)
     - **Publish directory**: `.`
   - Deploy site

3. **Configure Environment Variables**:
   - Go to Site Settings > Environment Variables
   - Add:
     ```
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_KEY=your-supabase-anon-key
     AZURE_CLIENT_ID=your-azure-client-id
     ```

### Option B: Deploy to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

3. **Configure Environment Variables**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_KEY
   vercel env add AZURE_CLIENT_ID
   ```

### Option C: Deploy to Azure Static Web Apps

1. **Azure CLI Setup**:
   ```bash
   az login
   az staticwebapp create \
     --name alumil-label-app \
     --resource-group your-resource-group \
     --source https://github.com/yourusername/alumil-label-app \
     --location "East US 2" \
     --branch main \
     --app-location "/" \
     --api-location "api" \
     --output-location "."
   ```

2. **Configure App Settings**:
   - Go to Azure Portal
   - Find your Static Web App
   - Go to Configuration
   - Add application settings

## 🧪 Step 5: Testing and Verification

### 5.1 Test Configuration

1. **Open Test Utility**:
   - Navigate to `https://your-domain.com/graph-api-test.html`
   - This utility will test all aspects of your configuration

2. **Test Steps**:
   - ✅ Test Configuration
   - ✅ Test Authentication
   - ✅ Test SharePoint Access
   - ✅ Test File Access
   - ✅ Download Test File

### 5.2 Test Core Features

1. **Authentication**:
   - Go to `/login.html`
   - Test user registration and login
   - Verify admin access

2. **SharePoint Integration**:
   - Go to `/admin.html`
   - Open "Database Management"
   - Click "Import from SharePoint (Graph API)"
   - Sign in and verify file import

3. **Label Printing**:
   - Test profile label printing
   - Test accessory label printing
   - Verify PDF generation

## 🔧 Step 6: Production Optimization

### 6.1 Performance Configuration

1. **Enable Caching**:
   - Configure CDN settings
   - Set cache headers (already configured in netlify.toml)

2. **Optimize Images**:
   - Compress logos and images
   - Use appropriate formats (WebP, SVG)

### 6.2 Security Configuration

1. **Update CSP Headers**:
   - Review Content Security Policy
   - Add your specific domains

2. **Configure HTTPS**:
   - Enable SSL on hosting platform
   - Update redirect URLs in Supabase and Azure AD

### 6.3 Monitoring Setup

1. **Error Tracking**:
   - Monitor browser console errors
   - Set up error logging service

2. **Performance Monitoring**:
   - Monitor page load times
   - Track API response times

## 📱 Step 7: Mobile Configuration (Optional)

### 7.1 PWA Setup

1. **Verify Manifest**:
   - Check `favicon/site.webmanifest`
   - Update app name and icons

2. **Test Mobile Experience**:
   - Test on mobile devices
   - Verify responsive design
   - Test offline functionality

## 🔄 Step 8: Maintenance and Updates

### 8.1 Regular Tasks

- [ ] Monitor error logs weekly
- [ ] Update dependencies monthly
- [ ] Backup database monthly
- [ ] Review security settings quarterly

### 8.2 Version Updates

1. **Test in Staging**:
   - Deploy to staging environment
   - Test all functionality

2. **Production Deployment**:
   - Deploy during off-peak hours
   - Monitor for issues post-deployment

## 🆘 Troubleshooting

### Common Issues

1. **Authentication Failed**:
   - Verify Azure AD client ID
   - Check redirect URLs
   - Ensure admin consent granted

2. **File Not Found**:
   - Verify SharePoint URL and path
   - Check file name and permissions
   - Test file access manually

3. **Database Connection Issues**:
   - Verify Supabase URL and key
   - Check RLS policies
   - Test database connection

### Getting Help

- 📖 **Documentation**: Check `/docs/` folder
- 🧪 **Testing**: Use `graph-api-test.html`
- 🐛 **Issues**: Check troubleshooting guide
- 💬 **Support**: Contact your system administrator

## ✅ Deployment Checklist

- [ ] Database setup complete
- [ ] Azure AD app registration configured
- [ ] Configuration files updated
- [ ] Application deployed
- [ ] Domain configured (if custom)
- [ ] SSL certificate installed
- [ ] All tests passing
- [ ] Error monitoring active
- [ ] Documentation updated
- [ ] Team trained on usage

## 🎉 Success!

Your Alumil Label App is now deployed and ready for production use! 

Key features now available:
- 🏷️ Professional label printing
- 📊 Direct SharePoint Excel import
- 👥 User management and authentication
- 📱 Mobile-responsive design
- 🔒 Enterprise-grade security

**Next Steps**: Train your team on using the application and monitor for any issues.

---

**Need Help?** Refer to the troubleshooting guide or contact your system administrator.