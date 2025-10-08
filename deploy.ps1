# Alumil Label App - Windows Deployment Script
# PowerShell script to automate deployment on Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$Platform = "",
    
    [Parameter(Mandatory=$false)]
    [string]$TestUrl = ""
)

# Enable strict error handling
$ErrorActionPreference = "Stop"

Write-Host "🚀 Alumil Label App - Windows Deployment Script" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Function definitions
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Check requirements
function Test-Requirements {
    Write-Info "Checking requirements..."
    
    $requiredFiles = @(
        "config\config.template.js",
        "database\schema.sql",
        "js\graph-api-config.js"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            Write-Error "$file not found!"
            exit 1
        }
    }
    
    Write-Success "All required files found"
}

# Setup configuration
function Initialize-Config {
    Write-Info "Setting up configuration..."
    
    if (-not (Test-Path "config\config.js")) {
        Copy-Item "config\config.template.js" "config\config.js"
        Write-Success "Created config\config.js from template"
        Write-Warning "Please edit config\config.js with your actual values before deploying"
    } else {
        Write-Info "config\config.js already exists"
    }
}

# Validate configuration
function Test-Configuration {
    Write-Info "Validating configuration..."
    
    $configValid = $true
    
    if (Test-Path "config\config.js") {
        $configContent = Get-Content "config\config.js" -Raw
        if ($configContent -match "your-project-id") {
            Write-Warning "Configuration contains placeholder values"
            Write-Warning "Please update config\config.js with your actual Supabase credentials"
            $configValid = $false
        }
    }
    
    if (Test-Path "js\graph-api-config.js") {
        $graphConfigContent = Get-Content "js\graph-api-config.js" -Raw
        if ($graphConfigContent -match "YOUR_AZURE_AD_CLIENT_ID_HERE") {
            Write-Warning "Azure AD client ID not configured in js\graph-api-config.js"
            $configValid = $false
        }
    }
    
    if ($configValid) {
        Write-Success "Configuration validation passed"
    }
    
    return $configValid
}

# Initialize Git repository
function Initialize-Git {
    Write-Info "Setting up Git repository..."
    
    if (-not (Test-Path ".git")) {
        git init
        Write-Success "Initialized Git repository"
    } else {
        Write-Info "Git repository already exists"
    }
    
    # Create .gitignore if it doesn't exist
    if (-not (Test-Path ".gitignore")) {
        $gitignoreContent = @"
# Configuration files with secrets
config/config.js

# Environment files
.env
.env.local
.env.production

# Dependencies
node_modules/
npm-debug.log*

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
*.log

# Build outputs
dist/
build/

# Temporary files
*.tmp
*.temp
"@
        $gitignoreContent | Out-File -FilePath ".gitignore" -Encoding UTF8
        Write-Success "Created .gitignore file"
    }
}

# Deploy to Netlify
function Deploy-ToNetlify {
    Write-Info "Deploying to Netlify..."
    
    # Check if Netlify CLI is installed
    try {
        $null = Get-Command netlify -ErrorAction Stop
    } catch {
        Write-Warning "Netlify CLI not found. Please install it first:"
        Write-Info "npm install -g netlify-cli"
        return $false
    }
    
    # Login to Netlify
    Write-Info "Please login to Netlify..."
    netlify login
    
    # Deploy
    Write-Info "Deploying to Netlify..."
    netlify deploy --prod --dir .
    
    Write-Success "Deployed to Netlify!"
    return $true
}

# Deploy to Vercel
function Deploy-ToVercel {
    Write-Info "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    try {
        $null = Get-Command vercel -ErrorAction Stop
    } catch {
        Write-Warning "Vercel CLI not found. Please install it first:"
        Write-Info "npm install -g vercel"
        return $false
    }
    
    # Deploy
    Write-Info "Deploying to Vercel..."
    vercel --prod
    
    Write-Success "Deployed to Vercel!"
    return $true
}

# Test deployment
function Test-Deployment {
    param([string]$Url)
    
    Write-Info "Testing deployment..."
    
    if ($Url) {
        Write-Info "Testing at: $Url"
        
        try {
            # Test main page
            $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Success "Main page accessible"
            }
            
            # Test API configuration page
            $testUrl = "$Url/graph-api-test.html"
            $testResponse = Invoke-WebRequest -Uri $testUrl -Method Head -TimeoutSec 10
            if ($testResponse.StatusCode -eq 200) {
                Write-Success "API test page accessible"
            }
            
            Write-Success "Deployment test completed"
            Write-Info "Visit $testUrl to test your configuration"
            
        } catch {
            Write-Warning "Could not test deployment: $($_.Exception.Message)"
        }
    } else {
        Write-Warning "No URL provided for testing"
    }
}

# Main deployment function
function Start-Deployment {
    Write-Host ""
    Write-Info "Starting deployment process..."
    Write-Host ""
    
    # Step 1: Check requirements
    Test-Requirements
    
    # Step 2: Setup configuration
    Initialize-Config
    
    # Step 3: Validate configuration
    if (-not (Test-Configuration)) {
        Write-Error "Configuration validation failed"
        Write-Info "Please update your configuration files and run the script again"
        exit 1
    }
    
    # Step 4: Setup Git
    Initialize-Git
    
    # Step 5: Choose deployment platform
    if (-not $Platform) {
        Write-Host ""
        Write-Info "Choose deployment platform:"
        Write-Host "1) Netlify"
        Write-Host "2) Vercel"
        Write-Host "3) Manual (copy files to your server)"
        Write-Host "4) Skip deployment"
        
        do {
            $choice = Read-Host "Enter your choice (1-4)"
        } while ($choice -notin @("1", "2", "3", "4"))
    } else {
        switch ($Platform.ToLower()) {
            "netlify" { $choice = "1" }
            "vercel" { $choice = "2" }
            "manual" { $choice = "3" }
            "skip" { $choice = "4" }
            default { 
                Write-Error "Invalid platform: $Platform"
                exit 1
            }
        }
    }
    
    switch ($choice) {
        "1" {
            Deploy-ToNetlify
        }
        "2" {
            Deploy-ToVercel
        }
        "3" {
            Write-Info "Manual deployment selected"
            Write-Info "Copy all files to your web server"
            Write-Info "Make sure to update configuration files with your actual values"
        }
        "4" {
            Write-Info "Skipping deployment"
        }
    }
    
    # Step 6: Test deployment
    if (-not $TestUrl -and $choice -in @("1", "2")) {
        Write-Host ""
        $TestUrl = Read-Host "Enter your deployment URL for testing (optional)"
    }
    
    if ($TestUrl) {
        Test-Deployment -Url $TestUrl
    }
    
    Write-Host ""
    Write-Success "Deployment process completed!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "1. Update configuration files with your actual credentials"
    Write-Host "2. Test the application at your deployment URL"
    Write-Host "3. Use /graph-api-test.html to verify SharePoint integration"
    Write-Host "4. Train your team on using the application"
    Write-Host ""
    Write-Info "Need help? Check the documentation in the docs\ folder"
}

# Run the deployment
try {
    Start-Deployment
} catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    Write-Info "Check the error message above and try again"
    exit 1
}