# Alumil App Favicon Assets

This directory contains all the favicon files for the Alumil Inventory System application.

## Files Description

- **favicon.svg** - Vector version of the favicon (yellow chevron/arrow based on Alumil branding)
- **favicon.ico** - 16x16, 32x32 and 48x48 favicon for legacy browsers (placeholder - should be replaced with actual ICO)
- **favicon-16x16.png** - 16x16 favicon for modern browsers (placeholder)
- **favicon-32x32.png** - 32x32 favicon for modern browsers (placeholder)
- **apple-touch-icon.png** - 180x180 icon for iOS devices (placeholder)
- **android-chrome-192x192.png** - 192x192 icon for Android Chrome (placeholder)
- **android-chrome-512x512.png** - 512x512 icon for Android Chrome (placeholder)
- **safari-pinned-tab.svg** - Monochrome SVG for Safari pinned tabs
- **mstile-150x150.png** - 150x150 icon for Windows 8/10 tiles (placeholder)
- **site.webmanifest** - Web App Manifest for PWA support
- **browserconfig.xml** - Configuration for Microsoft browser tiles

## Implementation

These favicon files are referenced in the HTML files using the following tags:

```html
<link rel="apple-touch-icon" sizes="180x180" href="../favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="../favicon/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../favicon/favicon-16x16.png">
<link rel="icon" type="image/svg+xml" href="../favicon/favicon.svg">
<link rel="manifest" href="../favicon/site.webmanifest">
<link rel="mask-icon" href="../favicon/safari-pinned-tab.svg" color="#ffc107">
<link rel="shortcut icon" href="../favicon/favicon.ico">
<meta name="msapplication-TileColor" content="#ffc107">
<meta name="msapplication-config" content="../favicon/browserconfig.xml">
<meta name="theme-color" content="#ffffff">
```

## Generation Commands

Commands to generate actual favicon files using ImageMagick:

```bash
# Generate PNG files from SVG
convert favicon.svg -resize 16x16 favicon-16x16.png
convert favicon.svg -resize 32x32 favicon-32x32.png
convert favicon.svg -resize 192x192 android-chrome-192x192.png
convert favicon.svg -resize 512x512 android-chrome-512x512.png
convert favicon.svg -resize 180x180 apple-touch-icon.png
convert favicon.svg -resize 150x150 mstile-150x150.png

# Create ICO file (combines multiple sizes)
convert favicon-16x16.png favicon-32x32.png -colors 256 favicon.ico
```

## Next Steps

For production deployment, replace the placeholder images with actual rendered PNG files at the appropriate sizes. You can use tools like:
- [Real Favicon Generator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

The favicon.svg and safari-pinned-tab.svg have been created to match the Alumil yellow chevron branding.