# Microsoft Graph API Setup Guide

This guide will help you set up Microsoft Graph API integration to upload Excel files directly from SharePoint.

## Prerequisites

1. Access to Azure Portal (portal.azure.com)
2. SharePoint site with the inventory Excel file
3. Administrator permissions to create Azure AD app registrations

## Step 1: Create Azure AD App Registration

1. **Go to Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Sign in with your organizational account

2. **Navigate to Azure Active Directory**
   - In the left sidebar, click on "Azure Active Directory"
   - Select "App registrations" from the menu

3. **Create New Registration**
   - Click "New registration"
   - Fill in the details:
     - **Name**: `Alumil Inventory App`
     - **Supported account types**: `Accounts in this organizational directory only`
     - **Redirect URI**: Select `Single-page application (SPA)` and enter your app URL (e.g., `https://your-app-domain.com`)

4. **Save the Application**
   - Click "Register"
   - **Copy the Application (client) ID** - you'll need this later

## Step 2: Configure API Permissions

1. **Add Microsoft Graph Permissions**
   - In your app registration, go to "API permissions"
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"

2. **Add Required Permissions**
   - `Sites.Read.All` - Read sites in all site collections
   - `Files.Read.All` - Read files in all site collections
   - `Files.ReadWrite.All` - Read and write files in all site collections

3. **Grant Admin Consent**
   - Click "Grant admin consent for [Your Organization]"
   - Confirm the consent

## Step 3: Configure SharePoint File Access

1. **Verify File Location**
   - Ensure your Excel file is located at: `https://alumildxb.sharepoint.com/sites/WarehouseAPP`
   - File name should be: `Inventory Data (masterfile).xlsx`

2. **Set File Permissions**
   - Make sure the file is accessible to users who will use the app
   - Consider setting appropriate sharing permissions

## Step 4: Update Application Configuration

1. **Edit Configuration File**
   - Open `js/graph-api-config.js`
   - Replace `1f06e228-fb33-47ec-9735-6f86a4b398e1` with your actual client ID

```javascript
window.GraphAPIConfig = {
  clientId: '1f06e228-fb33-47ec-9735-6f86a4b398e1',
  sharePoint: {
    baseUrl: 'https://alumildxb.sharepoint.com',
    sitePath: '/sites/WarehouseAPP',
    fileName: 'Inventory Data (masterfile).xlsx'
  }
  // ... rest of the configuration
};
```

2. **Verify SharePoint URL**
   - Update the SharePoint URL if your site is different
   - Update the site path and file name if needed

## Step 5: Test the Integration

1. **Open Admin Panel**
   - Go to your application's admin page
   - Open the "Database Management" modal

2. **Test Graph API Connection**
   - Click "Import from SharePoint (Graph API)"
   - You should be prompted to sign in with your Microsoft account

3. **Verify File Import**
   - After authentication, the app should download and process the Excel file
   - Check that profiles and accessories are loaded correctly

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify the client ID is correct
   - Check that redirect URI matches your app URL
   - Ensure admin consent has been granted

2. **File Not Found**
   - Verify the SharePoint URL and site path
   - Check the file name is correct
   - Ensure the file exists and is accessible

3. **Permission Denied**
   - Verify API permissions are correctly configured
   - Check that admin consent has been granted
   - Ensure the user has access to the SharePoint site

### Error Messages

- **"Client ID not configured"**: Update the client ID in `graph-api-config.js`
- **"Authentication failed"**: Check Azure AD app registration settings
- **"File not found"**: Verify SharePoint URL and file path
- **"Access denied"**: Check user permissions and admin consent

## Security Considerations

1. **Client ID Security**
   - The client ID is not sensitive and can be included in client-side code
   - The app uses the MSAL library for secure authentication

2. **Token Storage**
   - Access tokens are stored securely in browser localStorage
   - Tokens are automatically refreshed when needed

3. **File Access**
   - Users can only access files they have permission to in SharePoint
   - The app follows Microsoft Graph security model

## Additional Configuration Options

### Multiple Files
You can configure alternative file names in case the main file is not found:

```javascript
alternativeFiles: [
  'Inventory Data.xlsx',
  'masterfile.xlsx',
  'inventory.xlsx'
]
```

### Auto-Refresh
Enable automatic file refresh:

```javascript
features: {
  enableAutoRefresh: true,
  refreshInterval: 300000 // 5 minutes
}
```

### Offline Mode
Enable offline caching:

```javascript
features: {
  enableOfflineMode: true
}
```

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all configuration steps are completed
3. Test with a different user account
4. Contact your IT administrator for Azure AD assistance

## References

- [Microsoft Graph Documentation](https://docs.microsoft.com/en-us/graph/)
- [MSAL.js Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)