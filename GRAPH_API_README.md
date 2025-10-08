# Microsoft Graph API Integration for SharePoint Excel Upload

This integration allows you to upload Excel files directly from SharePoint using Microsoft Graph API in your admin panel.

## 🚀 Quick Start

1. **Test your configuration**: Open `graph-api-test.html` in your browser
2. **Follow setup guide**: Read `GRAPH_API_SETUP.md` for detailed instructions
3. **Configure Azure AD**: Set up app registration in Azure Portal
4. **Update config**: Add your client ID to `js/graph-api-config.js`
5. **Use the feature**: Click "Import from SharePoint (Graph API)" in admin panel

## 📁 Files Added

- `js/microsoft-graph-api.js` - Main Graph API client implementation
- `js/graph-api-config.js` - Configuration file (needs your client ID)
- `js/graph-api-config.template.js` - Configuration template with instructions
- `GRAPH_API_SETUP.md` - Complete setup guide
- `graph-api-test.html` - Configuration testing utility
- Updated `admin.html` - Added SharePoint upload button and functionality

## 🔧 Configuration Required

### Azure AD App Registration

You need to create an Azure AD app registration with these settings:

**Required API Permissions:**
- `Sites.Read.All` - Read sites in all site collections
- `Files.Read.All` - Read files in all site collections  
- `Files.ReadWrite.All` - Read and write files in all site collections

**Application Settings:**
- Platform: Single-page application (SPA)
- Redirect URI: Your application domain
- Account types: Accounts in this organizational directory only

### Configuration File

Update `js/graph-api-config.js`:

```javascript
window.GraphAPIConfig = {
  clientId: 'your-azure-ad-client-id-here', // Replace this!
  sharePoint: {
    baseUrl: 'https://alumildxb.sharepoint.com',
    sitePath: '/sites/WarehouseAPP',
    fileName: 'Inventory Data (masterfile).xlsx'
  }
  // ... rest of config
};
```

## 📱 How to Use

### In Admin Panel

1. Open admin panel (`admin.html`)
2. Click "Database Management" tile
3. Click "Import from SharePoint (Graph API)" button
4. Sign in with your Microsoft account when prompted
5. The system will automatically:
   - Authenticate with Microsoft Graph
   - Find your Excel file in SharePoint
   - Download and process the file
   - Load profiles and accessories data
   - Make data available for publishing to database

### Testing Configuration

1. Open `graph-api-test.html` in your browser
2. Click through the test buttons in order:
   - Test Configuration
   - Test Authentication  
   - Test SharePoint Access
   - Test File Access
   - Download Test File
3. Check console output for detailed information

## 🔒 Security Features

- **Secure Authentication**: Uses Microsoft MSAL library for OAuth 2.0 flow
- **Permission-Based Access**: Users can only access files they have SharePoint permissions for
- **Token Management**: Access tokens are securely stored and automatically refreshed
- **No Server Storage**: All authentication happens client-side

## ✅ Supported Excel File Formats

- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)
- `.csv` (Comma-separated values)

The system automatically detects:
- **Profiles sheet**: Any sheet containing "profile", "prof", or the first sheet
- **Accessories sheet**: Any sheet containing "accessor", "acc", or the second sheet

## 🔄 Data Processing

When importing from SharePoint, the system:

1. **Downloads** the Excel file from SharePoint
2. **Processes** all sheets and extracts profiles/accessories data
3. **Stores** data locally for review and editing
4. **Preserves** all original columns as additional metadata
5. **Makes available** for publishing to the live database

## 🛠️ Troubleshooting

### Common Issues

**"Client ID not configured"**
- Update the `clientId` in `js/graph-api-config.js`
- Make sure you copied the correct Application (client) ID from Azure Portal

**"Authentication failed"**
- Check Azure AD app registration settings
- Verify redirect URI matches your application domain
- Ensure admin consent has been granted

**"File not found"**
- Verify SharePoint URL and site path in configuration
- Check that the Excel file exists and is accessible
- Try using an alternative file name in the configuration

**"Access denied"**
- Ensure user has permissions to access the SharePoint site
- Check that API permissions are granted and admin consent given
- Verify the user account has access to the specific file

### Debug Mode

Enable debug mode in configuration:

```javascript
features: {
  enableDebugMode: true
}
```

This will provide detailed console logging for troubleshooting.

## 📊 Features

### Automatic File Detection
- Searches for multiple file name variations
- Finds files across the entire SharePoint site
- Falls back to alternative names if primary file not found

### Smart Sheet Detection
- Automatically identifies profiles and accessories sheets
- Supports various naming conventions
- Processes unlimited rows and columns

### Complete Data Preservation
- Imports ALL columns from Excel sheets
- Preserves extra metadata in additional_data field
- No data loss during import process

### User-Friendly Interface
- Clear status messages and progress indicators
- Detailed error messages with suggestions
- One-click import process

## 🔄 Sync with Existing System

The Graph API integration works seamlessly with the existing system:

- **Compatible** with current Excel upload functionality
- **Uses same** data processing and validation logic
- **Integrates** with inventory state management
- **Supports** publishing to live database for all users

## 📝 Development Notes

### Architecture

- **MicrosoftGraphClient**: Main client class for Graph API operations
- **Configuration**: Centralized config with validation
- **Error Handling**: Comprehensive error messages and recovery
- **UI Integration**: Seamless integration with existing admin interface

### Extension Points

- **Custom File Filters**: Add support for different file types
- **Batch Processing**: Handle multiple files at once
- **Advanced Permissions**: Role-based access to different SharePoint sites
- **Automated Sync**: Schedule regular imports from SharePoint

## 📞 Support

For setup assistance:

1. Use the configuration test tool (`graph-api-test.html`)
2. Check browser console for detailed error messages
3. Refer to the setup guide (`GRAPH_API_SETUP.md`)
4. Contact your IT administrator for Azure AD assistance

## 📚 References

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [MSAL.js Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [SharePoint API Reference](https://docs.microsoft.com/en-us/graph/api/resources/sharepoint?view=graph-rest-1.0)