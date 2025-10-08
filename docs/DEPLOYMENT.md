# Deployment Package Structure

## 📁 File Organization

```
Alumil-Deploy-v2/
├── 📄 index.html                    # Landing page
├── 👥 admin.html                    # Admin dashboard with Graph API
├── 🏠 home.html                     # User home page  
├── 🔐 login.html                    # Authentication
├── 📝 signup.html                   # User registration
├── 🏷️ profile-label-printing.html   # Profile label printing
├── 🏷️ acc-label-printing.html       # Accessory label printing
├── 🏷️ rack-label-printing.html      # Rack label printing
├── 🔍 search-inventory.html         # Inventory search
├── 📊 graph-api-test.html          # API testing utility
├── 🎨 assets/                       # Static assets
│   ├── css/                        # Stylesheets
│   └── images/                     # Images and icons
├── ⚙️ js/                           # JavaScript modules
│   ├── microsoft-graph-api.js      # Graph API integration
│   ├── graph-api-config.js         # Graph API configuration
│   ├── excel-uploader.js           # Excel upload functionality
│   ├── auth-helper.js              # Authentication
│   ├── inventory-manager.js        # Inventory management
│   └── [other modules]             # Additional functionality
├── 🗄️ database/                     # Database scripts
│   ├── schema.sql                  # Main database schema
│   ├── seed-data.sql               # Sample data
│   └── migrations/                 # Database migrations
├── 📋 config/                       # Configuration files
│   ├── config.template.js          # Configuration template
│   ├── netlify.toml                # Netlify configuration
│   └── staticwebapp.config.json    # Azure Static Web Apps config
├── 📖 docs/                         # Documentation
│   ├── SETUP.md                    # Setup guide
│   ├── CONFIGURATION.md            # Configuration guide
│   ├── GRAPH_API_SETUP.md          # SharePoint integration
│   └── TROUBLESHOOTING.md          # Common issues
└── 📜 README.md                     # Project overview
```

## 🚀 Quick Start

1. **Configure Environment**
   ```bash
   cp config/config.template.js config/config.js
   # Edit config/config.js with your settings
   ```

2. **Setup Database**
   ```sql
   -- Import database/schema.sql to Supabase
   ```

3. **Deploy**
   - Netlify: Connect GitHub repo and deploy
   - Azure: Use staticwebapp.config.json
   - Custom: Upload all files to web server

## 🔧 Configuration Files

### Primary Configuration
- `config/config.template.js` - Main configuration template
- `js/graph-api-config.js` - SharePoint integration settings
- `netlify.toml` - Netlify deployment configuration
- `staticwebapp.config.json` - Azure Static Web Apps configuration

### Environment Variables
Set these in your hosting platform:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `AZURE_CLIENT_ID` - Azure AD application client ID

## 🗄️ Database Setup

1. **Create Supabase Project**
2. **Import Schema**
   ```sql
   -- Run database/schema.sql in Supabase SQL editor
   ```
3. **Configure RLS**
   - Row Level Security policies are included in schema
4. **Test Connection**
   - Use graph-api-test.html to verify setup

## 🔒 Security Configuration

### Azure AD (SharePoint Integration)
1. Create app registration in Azure Portal
2. Configure API permissions:
   - Sites.Read.All
   - Files.Read.All  
   - Files.ReadWrite.All
3. Grant admin consent
4. Update client ID in configuration

### Supabase (Database)
1. Enable RLS on all tables
2. Configure authentication providers
3. Set up email templates
4. Configure CORS settings

## 📱 Features Included

### Core Functionality
- ✅ Inventory management
- ✅ Label printing (PDF generation)
- ✅ User authentication
- ✅ Role-based access control
- ✅ Mobile responsive design

### Microsoft Graph API Integration
- ✅ Direct SharePoint file import
- ✅ Automatic Excel processing
- ✅ Smart sheet detection
- ✅ Real-time data updates
- ✅ Fallback file search

### Advanced Features
- ✅ Offline data caching
- ✅ Activity logging
- ✅ Print preview
- ✅ Batch label printing
- ✅ Advanced search and filtering

## 🧪 Testing

### Manual Testing
1. Open `graph-api-test.html`
2. Test configuration validation
3. Test SharePoint authentication
4. Test file access and download
5. Verify Excel parsing

### Automated Testing
```bash
# Run configuration validation
node scripts/validate-config.js

# Test database connection
node scripts/test-database.js
```

## 📊 Monitoring

### Error Tracking
- Browser console errors
- Network request failures
- Authentication issues
- File processing errors

### Performance Metrics
- Page load times
- File download speeds
- Database query performance
- API response times

## 🔄 Updates and Maintenance

### Regular Tasks
- Monitor error logs
- Update dependencies
- Backup database
- Review security settings

### Version Updates
1. Test in staging environment
2. Update version in config
3. Deploy to production
4. Monitor for issues

## 🆘 Support

- 📖 Documentation: `/docs/` folder
- 🧪 Testing: `graph-api-test.html`
- 🐛 Issues: Check troubleshooting guide
- 💬 Community: GitHub Discussions