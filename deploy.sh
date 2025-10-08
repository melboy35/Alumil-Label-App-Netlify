#!/bin/bash

# Alumil Label App - Automated Deployment Script
# This script helps automate the deployment process

set -e  # Exit on any error

echo "🚀 Alumil Label App - Deployment Script"
echo "========================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if required files exist
check_requirements() {
    print_info "Checking requirements..."
    
    if [ ! -f "config/config.template.js" ]; then
        print_error "config/config.template.js not found!"
        exit 1
    fi
    
    if [ ! -f "database/schema.sql" ]; then
        print_error "database/schema.sql not found!"
        exit 1
    fi
    
    if [ ! -f "js/graph-api-config.js" ]; then
        print_error "js/graph-api-config.js not found!"
        exit 1
    fi
    
    print_status "All required files found"
}

# Setup configuration
setup_config() {
    print_info "Setting up configuration..."
    
    if [ ! -f "config/config.js" ]; then
        cp config/config.template.js config/config.js
        print_status "Created config/config.js from template"
        print_warning "Please edit config/config.js with your actual values before deploying"
    else
        print_info "config/config.js already exists"
    fi
}

# Validate configuration
validate_config() {
    print_info "Validating configuration..."
    
    if grep -q "your-project-id" config/config.js 2>/dev/null; then
        print_warning "Configuration contains placeholder values"
        print_warning "Please update config/config.js with your actual Supabase and Azure AD credentials"
        return 1
    fi
    
    if grep -q "YOUR_AZURE_AD_CLIENT_ID_HERE" js/graph-api-config.js; then
        print_warning "Azure AD client ID not configured in js/graph-api-config.js"
        return 1
    fi
    
    print_status "Configuration validation passed"
    return 0
}

# Initialize git repository
init_git() {
    print_info "Setting up Git repository..."
    
    if [ ! -d ".git" ]; then
        git init
        print_status "Initialized Git repository"
    else
        print_info "Git repository already exists"
    fi
    
    # Create .gitignore if it doesn't exist
    if [ ! -f ".gitignore" ]; then
        cat > .gitignore << EOF
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
EOF
        print_status "Created .gitignore file"
    fi
}

# Deploy to Netlify
deploy_netlify() {
    print_info "Deploying to Netlify..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        print_warning "Netlify CLI not found. Installing..."
        npm install -g netlify-cli
    fi
    
    # Login to Netlify
    print_info "Please login to Netlify..."
    netlify login
    
    # Deploy
    print_info "Deploying to Netlify..."
    netlify deploy --prod --dir .
    
    print_status "Deployed to Netlify!"
}

# Deploy to Vercel
deploy_vercel() {
    print_info "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Deploy
    print_info "Deploying to Vercel..."
    vercel --prod
    
    print_status "Deployed to Vercel!"
}

# Test deployment
test_deployment() {
    print_info "Testing deployment..."
    
    if [ -n "$1" ]; then
        DOMAIN=$1
        print_info "Testing at: $DOMAIN"
        
        # Test main page
        if curl -s "$DOMAIN" > /dev/null; then
            print_status "Main page accessible"
        else
            print_error "Main page not accessible"
            return 1
        fi
        
        # Test API configuration page
        if curl -s "$DOMAIN/graph-api-test.html" > /dev/null; then
            print_status "API test page accessible"
        else
            print_warning "API test page not accessible"
        fi
        
        print_status "Deployment test completed"
        print_info "Visit $DOMAIN/graph-api-test.html to test your configuration"
    else
        print_warning "No domain provided for testing"
    fi
}

# Main deployment flow
main() {
    echo ""
    print_info "Starting deployment process..."
    echo ""
    
    # Step 1: Check requirements
    check_requirements
    
    # Step 2: Setup configuration
    setup_config
    
    # Step 3: Validate configuration
    if ! validate_config; then
        print_error "Configuration validation failed"
        print_info "Please update your configuration files and run the script again"
        exit 1
    fi
    
    # Step 4: Setup Git
    init_git
    
    # Step 5: Choose deployment platform
    echo ""
    print_info "Choose deployment platform:"
    echo "1) Netlify"
    echo "2) Vercel"
    echo "3) Manual (copy files to your server)"
    echo "4) Skip deployment"
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1)
            deploy_netlify
            ;;
        2)
            deploy_vercel
            ;;
        3)
            print_info "Manual deployment selected"
            print_info "Copy all files to your web server"
            print_info "Make sure to update configuration files with your actual values"
            ;;
        4)
            print_info "Skipping deployment"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Step 6: Test deployment (if URL provided)
    echo ""
    read -p "Enter your deployment URL for testing (optional): " url
    if [ -n "$url" ]; then
        test_deployment "$url"
    fi
    
    echo ""
    print_status "Deployment process completed!"
    echo ""
    print_info "Next steps:"
    echo "1. Update configuration files with your actual credentials"
    echo "2. Test the application at your deployment URL"
    echo "3. Use /graph-api-test.html to verify SharePoint integration"
    echo "4. Train your team on using the application"
    echo ""
    print_info "Need help? Check the documentation in the docs/ folder"
}

# Run main function
main "$@"