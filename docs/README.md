# Documentation

## Screenshots

Add screenshots here after testing the extension:

- `screenshot.png` — Main sidebar view in Overleaf
- `popup.png` — Browser toolbar popup
- `options.png` — Settings page

## User Guide

### Getting Your ADS API Token

1. Go to [ADS User Settings](https://ui.adsabs.harvard.edu/user/settings/token)
2. Log in with your ADS account (create one if needed)
3. Your API token is displayed on the page
4. Copy the entire token string

### Setting Up the Extension

1. Click the ADS for Overleaf icon in your browser toolbar
2. Click "Set up now" or go to Settings
3. Paste your API token
4. Click "Save Token"
5. If successful, you'll see "Token saved and validated!"

### Using the Citation Panel

1. Open any project on Overleaf
2. Click the "ADS" button in the Overleaf toolbar
3. Or use the keyboard shortcut: `Ctrl+Shift+C` (Windows/Linux) or `Cmd+Shift+C` (Mac)

### Browsing Libraries

1. Open the ADS panel
2. Select a library from the dropdown
3. Scroll through your papers
4. Click any paper to insert a citation

### Searching ADS

1. Open the ADS panel
2. Type your search query in the search box
3. Press Enter or click the search button
4. Click any result to insert a citation

### Configuring BibTeX Format

1. Open extension Settings
2. Choose your preferred:
   - **Key format**: How citation keys are generated
   - **Journal format**: How journal names appear
   - **Max authors**: When to truncate with "et al."
   - **Citation command**: Which LaTeX command to use

## Troubleshooting

### "Token not configured" error

Make sure you've saved your ADS API token in the extension settings.

### Libraries not loading

1. Check your internet connection
2. Verify your API token is still valid on ADS
3. Click the refresh button to reload libraries

### Citation not inserting

1. Make sure your cursor is in the Overleaf editor
2. Try clicking the paper again
3. If it still doesn't work, the BibTeX is copied to clipboard — paste manually

### Panel not appearing

1. Make sure you're on an Overleaf project page (URL contains `/project/`)
2. Try refreshing the page
3. Check if the extension is enabled in your browser

## FAQ

**Q: Is my API token secure?**

A: Yes. Your token is stored locally in your browser and only sent to the official ADS API servers over HTTPS.

**Q: Does this work on mobile?**

A: Browser extensions don't work on mobile browsers. Use the ADS website directly on mobile.

**Q: Can I use this with ShareLaTeX?**

A: This extension is designed for Overleaf. It may work on self-hosted Overleaf/ShareLaTeX instances but is not officially supported.

**Q: How do I report a bug?**

A: Open an issue on [GitHub](https://github.com/yipihey/inspire-for-overleaf/issues) with details about the problem.
