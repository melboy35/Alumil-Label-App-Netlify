/**
 * Alumil Label App - Production Configuration Template
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Copy this file to 'config.js' (remove .template)
 * 2. Update all placeholder values with your actual configuration
 * 3. Deploy to your hosting platform
 */

// =====================================
// SUPABASE CONFIGURATION (REQUIRED)
// =====================================
// Get these from: https://supabase.com/dashboard/project/[your-project]/settings/api
window.SUPABASE_URL = 'https://grsikgldzkqntlotawyi.supabase.co';
window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyc2lrZ2xkemtxbnRsb3Rhd3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTQ0NTQsImV4cCI6MjA3NTE3MDQ1NH0.RtGvQ7vDNFNiabghTWVEzFroA4Z_fc8ZTr9p07fk_eQ'; // Replace with your actual anon key
window.ORG_ID = '00000000-0000-0000-0000-000000000000'; // Your organization ID

// =====================================
// MICROSOFT GRAPH API CONFIGURATION
// =====================================
window.GraphAPIConfig = {
  // Azure AD Application (client) ID - REQUIRED for SharePoint integration
  // Get from: Azure Portal > Azure AD > App registrations > Your App > Overview
  clientId: '1f06e228-fb33-47ec-9735-6f86a4b398e1',
  
  // Azure AD Tenant ID - REQUIRED for specific tenant authentication
  // Get from: Azure Portal > Azure AD > Overview > Tenant ID
  tenantId: '0ac1dc26-ec64-42c1-8f72-cb0a8b173849',
  
  // SharePoint Configuration
  sharePoint: {
    // Your SharePoint tenant URL
    baseUrl: 'https://alumildxb.sharepoint.com/sites/WarehouseAPP',
    
    // Site path where your Excel file is located
    sitePath: '/sites/WarehouseAPP',
    
    // Primary Excel file name
    fileName: 'Inventory Data (masterfile).xlsx',
    
    // Alternative file names to search if primary not found
    alternativeFiles: [
      'Inventory Data.xlsx',
      'masterfile.xlsx',
      'inventory.xlsx'
    ]
  },
  
  // API Scopes (DO NOT CHANGE unless you know what you're doing)
  scopes: [
    'https://graph.microsoft.com/Sites.Read.All',
    'https://graph.microsoft.com/Files.Read.All',
    'https://graph.microsoft.com/Files.ReadWrite.All'
  ],
  
  // MSAL Configuration
  msal: {
    authority: 'https://login.microsoftonline.com/0ac1dc26-ec64-42c1-8f72-cb0a8b173849',
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  },
  
  // Feature flags
  features: {
    enableAutoRefresh: false,        // Enable automatic data refresh
    refreshInterval: 300000,         // 5 minutes in milliseconds
    enableOfflineMode: true,         // Enable offline caching
    maxRetries: 3,                   // Max retry attempts
    enableDebugMode: false           // Enable debug logging
  }
};

// =====================================
// APPLICATION CONFIGURATION
// =====================================
window.AppConfig = {
  // Application metadata
  name: 'Alumil Label App',
  version: '2.0.0',
  environment: 'production', // 'development', 'staging', 'production'
  
  // Feature toggles
  features: {
    enableGraphAPI: true,            // Enable SharePoint integration
    enableOfflineMode: true,         // Enable offline functionality
    enableActivityLogging: true,     // Enable user activity tracking
    enablePrintPreview: true,        // Enable label print preview
    enableMobileApp: true,           // Enable mobile PWA features
    enableAdvancedSearch: true       // Enable advanced search features
  },
  
  // UI Configuration
  ui: {
    defaultTheme: 'light',           // 'light' or 'dark'
    showBranding: true,              // Show Alumil branding
    compactMode: false,              // Compact UI mode
    animationsEnabled: true          // Enable UI animations
  },
  
  // Performance settings
  performance: {
    enableCaching: true,             // Enable data caching
    cacheTimeout: 3600000,           // 1 hour in milliseconds
    maxCacheSize: 50,                // Max MB for cache
    lazyLoadImages: true             // Lazy load images
  }
};

// =====================================
// VALIDATION & INITIALIZATION
// =====================================

// Configuration validation
window.validateConfig = function() {
  const errors = [];
  
  // Check Supabase configuration
  if (!window.SUPABASE_URL || window.SUPABASE_URL === 'https://your-project-id.supabase.co') {
    errors.push('❌ Supabase URL not configured');
  }
  
  if (!window.SUPABASE_KEY || window.SUPABASE_KEY === 'your-supabase-anon-key') {
    errors.push('❌ Supabase key not configured');
  }
  
  // Check Graph API configuration (if enabled)
  if (window.AppConfig.features.enableGraphAPI) {
    if (!window.GraphAPIConfig.clientId || window.GraphAPIConfig.clientId === 'your-azure-ad-client-id-here') {
      errors.push('⚠️ Azure AD Client ID not configured (SharePoint integration disabled)');
    }
  }
  
  if (errors.length > 0) {
    console.group('🔧 Configuration Issues');
    errors.forEach(error => console.warn(error));
    console.warn('📖 Please refer to deployment documentation');
    console.groupEnd();
    return false;
  }
  
  console.log('✅ Configuration validated successfully');
  return true;
};

// Auto-initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  window.validateConfig();
  
  // Initialize Supabase client
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
    window._sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'alumil_auth_token'
      }
    });
    
    console.log('✅ Supabase client initialized');
  }
});

// =====================================
// DEPLOYMENT CHECKLIST
// =====================================
/*
BEFORE DEPLOYING:

□ Database Setup:
  - Import database-schema.sql to Supabase
  - Configure Row Level Security (RLS)
  - Test database connection

□ Supabase Configuration:
  - Update SUPABASE_URL
  - Update SUPABASE_KEY
  - Set appropriate ORG_ID

□ Azure AD Setup (for SharePoint):
  - Create app registration
  - Configure API permissions
  - Grant admin consent
  - Update clientId

□ SharePoint Configuration:
  - Verify site URL and path
  - Confirm Excel file name and location
  - Test file access permissions

□ Testing:
  - Run graph-api-test.html
  - Test all major features
  - Verify authentication works
  - Test label printing

□ Production Settings:
  - Set environment to 'production'
  - Disable debug modes
  - Configure appropriate cache settings
  - Review security settings

□ Deployment:
  - Build and deploy to hosting platform
  - Configure domain and SSL
  - Test production deployment
  - Monitor for errors

AFTER DEPLOYMENT:
  - Test all functionality in production
  - Monitor error logs
  - Verify performance metrics
  - Document any issues
*/