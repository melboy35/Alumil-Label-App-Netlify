/**
 * Microsoft Graph API Integration for SharePoint Excel Upload
 * Handles authentication and file operations with Microsoft Graph API
 */

class MicrosoftGraphClient {
  constructor() {
    this.clientId = null;
    this.accessToken = null;
    this.isAuthenticated = false;
    this.sharePointUrl = 'https://alumildxb.sharepoint.com';
    this.sitePath = '/sites/WarehouseAPP';
    this.fileName = 'Inventory Data (masterfile).xlsx';
  }

  /**
   * Initialize Graph API client with configuration
   */
  async init(clientId) {
    this.clientId = clientId;
    
    // Update SharePoint configuration from global config
    if (window.GraphAPIConfig) {
      const config = window.GraphAPIConfig.sharePoint;
      this.sharePointUrl = config.baseUrl;
      this.sitePath = config.sitePath;
      this.fileName = config.fileName;
      this.alternativeFiles = config.alternativeFiles || [];
    }
    
    // Load Microsoft Graph SDK if not already loaded
    if (!window.MicrosoftGraph) {
      await this.loadGraphSDK();
    }
    
    console.log('✅ Microsoft Graph client initialized');
    console.log('📍 SharePoint URL:', this.sharePointUrl + this.sitePath);
    console.log('📄 Target file:', this.fileName);
  }

  /**
   * Load Microsoft Graph SDK dynamically
   */
  async loadGraphSDK() {
    return new Promise((resolve, reject) => {
      if (window.MicrosoftGraph) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client@3.0.7/lib/graph-js-sdk.min.js';
      script.onload = () => {
        console.log('📦 Microsoft Graph SDK loaded');
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Microsoft Graph SDK'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Authenticate with Microsoft Graph using MSAL
   */
  async authenticate() {
    try {
      if (!this.clientId) {
        throw new Error('Client ID not configured. Please configure Azure AD application.');
      }

      // Load MSAL library if not already loaded
      if (!window.msal) {
        await this.loadMSAL();
      }

      const msalConfig = {
        auth: {
          clientId: this.clientId,
          authority: 'https://login.microsoftonline.com/common',
          redirectUri: window.location.origin
        },
        cache: {
          cacheLocation: 'localStorage',
          storeAuthStateInCookie: false
        }
      };

      const msalInstance = new window.msal.PublicClientApplication(msalConfig);
      await msalInstance.initialize();

      const loginRequest = {
        scopes: [
          'https://graph.microsoft.com/Sites.Read.All',
          'https://graph.microsoft.com/Files.Read.All',
          'https://graph.microsoft.com/Files.ReadWrite.All'
        ]
      };

      // Try silent token acquisition first
      let response;
      try {
        const silentRequest = {
          ...loginRequest,
          account: msalInstance.getActiveAccount()
        };
        response = await msalInstance.acquireTokenSilent(silentRequest);
      } catch (silentError) {
        // If silent acquisition fails, use popup
        response = await msalInstance.acquireTokenPopup(loginRequest);
      }

      this.accessToken = response.accessToken;
      this.isAuthenticated = true;

      console.log('✅ Microsoft Graph authentication successful');
      return true;

    } catch (error) {
      console.error('❌ Microsoft Graph authentication failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Load MSAL library dynamically
   */
  async loadMSAL() {
    return new Promise((resolve, reject) => {
      if (window.msal) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js';
      script.onload = () => {
        console.log('📦 MSAL library loaded');
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load MSAL library'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Get SharePoint site information
   */
  async getSiteInfo() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    try {
      const graphClient = window.MicrosoftGraph.Client.init({
        authProvider: {
          getAccessToken: async () => this.accessToken
        }
      });

      // Get site information using hostname and site path
      const hostname = new URL(this.sharePointUrl).hostname;
      const sitePath = this.sitePath;
      
      const site = await graphClient
        .api(`/sites/${hostname}:${sitePath}`)
        .get();

      console.log('📍 SharePoint site found:', site.displayName);
      return site;

    } catch (error) {
      console.error('❌ Failed to get site info:', error);
      throw new Error(`Failed to access SharePoint site: ${error.message}`);
    }
  }

  /**
   * Search for the inventory Excel file in SharePoint
   */
  async findInventoryFile() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    try {
      const site = await this.getSiteInfo();
      
      const graphClient = window.MicrosoftGraph.Client.init({
        authProvider: {
          getAccessToken: async () => this.accessToken
        }
      });

      // First try to find the primary file
      const filesToSearch = [this.fileName, ...(this.alternativeFiles || [])];
      
      for (const fileName of filesToSearch) {
        try {
          console.log(`🔍 Searching for file: ${fileName}`);
          
          // Search for the file in the site
          const searchResults = await graphClient
            .api(`/sites/${site.id}/drive/search(q='${fileName}')`)
            .get();

          if (searchResults.value && searchResults.value.length > 0) {
            // Find exact match first
            let file = searchResults.value.find(f => f.name === fileName);
            
            // If no exact match, take the first result
            if (!file) {
              file = searchResults.value[0];
            }
            
            console.log('📄 Inventory file found:', file.name);
            console.log('📍 File location:', file.webUrl);
            return file;
          }
        } catch (searchError) {
          console.warn(`Search failed for ${fileName}:`, searchError.message);
          continue;
        }
      }
      
      throw new Error(`None of the inventory files found: ${filesToSearch.join(', ')}`);

    } catch (error) {
      console.error('❌ Failed to find inventory file:', error);
      throw new Error(`Failed to find inventory file: ${error.message}`);
    }
  }

  /**
   * Download Excel file from SharePoint
   */
  async downloadInventoryFile() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    try {
      const file = await this.findInventoryFile();
      
      const graphClient = window.MicrosoftGraph.Client.init({
        authProvider: {
          getAccessToken: async () => this.accessToken
        }
      });

      // Get file content
      const fileContent = await graphClient
        .api(`/sites/${file.parentReference.siteId}/drive/items/${file.id}/content`)
        .responseType('arraybuffer')
        .get();

      console.log('📥 File downloaded successfully:', file.name);
      
      return {
        name: file.name,
        size: file.size,
        lastModified: file.lastModifiedDateTime,
        content: fileContent
      };

    } catch (error) {
      console.error('❌ Failed to download file:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Upload Excel file from SharePoint to the application
   */
  async uploadFromSharePoint() {
    try {
      const statusEl = document.getElementById('graph-api-status');
      
      this.setStatus('processing', 'Connecting to Microsoft Graph API...');

      // Authenticate if not already authenticated
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      this.setStatus('processing', 'Downloading file from SharePoint...');

      // Download the file
      const fileData = await this.downloadInventoryFile();

      this.setStatus('processing', 'Processing Excel file...');

      // Process the Excel file using existing uploader
      if (window.AlumilExcelUploader && window._sbClient) {
        const uploader = new window.AlumilExcelUploader(window._sbClient);
        const processedData = await uploader.processExcelFileFromBuffer(
          fileData.content, 
          fileData.name
        );

        // Store in local cache
        localStorage.setItem('excelCache', JSON.stringify({
          ...processedData,
          source: 'SharePoint Graph API',
          fileSize: fileData.size,
          lastModified: fileData.lastModified
        }));

        // Update UI
        this.updateUI(processedData, fileData);

        this.setStatus('success', 
          `✅ Successfully imported from SharePoint! ${processedData.profiles.length} profiles and ${processedData.accessories.length} accessories loaded.`
        );

        // Trigger data refresh in other components
        window.dispatchEvent(new CustomEvent('alumilDataUpdated', {
          detail: { 
            source: 'SharePoint Graph API',
            timestamp: new Date().toISOString(),
            profiles: processedData.profiles.length,
            accessories: processedData.accessories.length
          }
        }));

      } else {
        throw new Error('Excel uploader not available');
      }

    } catch (error) {
      console.error('❌ SharePoint upload failed:', error);
      this.setStatus('error', `Failed to import from SharePoint: ${error.message}`);
      
      // Show configuration instructions if authentication fails
      if (error.message.includes('Client ID not configured')) {
        this.showConfigurationInstructions();
      }
    }
  }

  /**
   * Update UI with imported data
   */
  updateUI(data, fileData) {
    // Update file name display
    const nameEl = document.getElementById("file-name-display");
    if (nameEl) {
      nameEl.textContent = `File name: ${fileData.name} (SharePoint)`;
    }

    // Update data status
    const statusEl = document.getElementById("data-status");
    if (statusEl) {
      statusEl.classList.remove("hidden");
    }

    // Update counters
    const totalEl = document.getElementById("stat-total-items");
    const profilesEl = document.getElementById("profiles-count");
    const accessoriesEl = document.getElementById("accessories-count");
    
    const total = data.profiles.length + data.accessories.length;
    if (totalEl) totalEl.textContent = total;
    if (profilesEl) profilesEl.textContent = String(data.profiles.length);
    if (accessoriesEl) accessoriesEl.textContent = String(data.accessories.length);

    // Update modal indicators if available
    if (typeof updateModalIndicators === 'function') {
      updateModalIndicators(data.profiles, data.accessories);
    }
  }

  /**
   * Set status message
   */
  setStatus(type, message) {
    const statusEl = document.getElementById('graph-api-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `upload-status ${type}`;
      statusEl.style.display = 'block';
    }

    console.log(`📊 Graph API Status: ${type} - ${message}`);

    // Auto-clear success/info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (statusEl) {
          statusEl.style.display = 'none';
        }
      }, 5000);
    }
  }

  /**
   * Show configuration instructions for Azure AD setup
   */
  showConfigurationInstructions() {
    const instructions = `
🔧 MICROSOFT GRAPH API SETUP REQUIRED

To use SharePoint integration, you need to configure Azure AD:

1. Go to Azure Portal (portal.azure.com)
2. Navigate to Azure Active Directory > App registrations
3. Create a new app registration:
   - Name: "Alumil Inventory App"
   - Supported account types: Accounts in any organizational directory
   - Redirect URI: ${window.location.origin}

4. Configure API permissions:
   - Microsoft Graph > Delegated permissions
   - Add: Sites.Read.All, Files.Read.All, Files.ReadWrite.All

5. Copy the Application (client) ID
6. Add it to your application configuration

7. Grant admin consent for the permissions

Contact your system administrator for help with Azure AD configuration.
    `;
    
    setTimeout(() => {
      alert(instructions);
    }, 1000);
  }

  /**
   * Test Graph API connection
   */
  async testConnection() {
    try {
      this.setStatus('processing', 'Testing Microsoft Graph connection...');
      
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      const site = await this.getSiteInfo();
      const file = await this.findInventoryFile();

      this.setStatus('success', 
        `✅ Connection successful! Found "${file.name}" in SharePoint site "${site.displayName}"`
      );

      return true;

    } catch (error) {
      this.setStatus('error', `Connection test failed: ${error.message}`);
      return false;
    }
  }
}

// Initialize global instance
window.MicrosoftGraphClient = MicrosoftGraphClient;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.graphClient = new MicrosoftGraphClient();
  console.log('🔗 Microsoft Graph client ready');
});