# Claude.md - AI Assistant Guide

This document helps AI assistants understand the ADS for Overleaf browser extension codebase for effective contributions.

## Project Overview

**ADS for Overleaf** is a browser extension that integrates NASA's Astrophysics Data System (ADS) with the Overleaf LaTeX editor. It allows astronomers and astrophysicists to search their ADS libraries, insert citations, and export BibTeX directly within Overleaf.

**Target Users**: Academic researchers writing papers in Overleaf who use NASA ADS for bibliography management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │   Popup     │     │   Options   │     │ Content Script  │   │
│  │ (popup/)    │     │ (options/)  │     │ (content/)      │   │
│  └──────┬──────┘     └──────┬──────┘     └────────┬────────┘   │
│         │                   │                      │            │
│         └───────────────────┴──────────────────────┘            │
│                             │                                    │
│                    Message Passing                               │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │ Service Worker  │                          │
│                    │ (background/)   │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │   Libraries     │                          │
│                    │   (lib/)        │                          │
│                    │  - ads-api.js   │                          │
│                    │  - storage.js   │                          │
│                    │  - bibtex-utils │                          │
│                    └────────┬────────┘                          │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS
                    ┌─────────▼─────────┐
                    │   NASA ADS API    │
                    │ api.adsabs.harvard│
                    └───────────────────┘
```

### Component Responsibilities

| Component | Location | Purpose |
|-----------|----------|---------|
| Service Worker | `background/service-worker.js` | Central message router, API calls, caching |
| Content Script | `content/overleaf-injector.js` | Sidebar UI, citation insertion into editor |
| Popup | `popup/` | Quick access to libraries, status display |
| Options | `options/` | API token management, preferences |
| ADS API Client | `lib/ads-api.js` | NASA ADS API wrapper with rate limiting |
| Storage | `lib/storage.js` | Browser storage abstraction with caching |
| BibTeX Utils | `lib/bibtex-utils.js` | Citation key generation, BibTeX parsing |

## Key Patterns

### Message Passing Protocol

All API calls go through the service worker via message passing:

```javascript
// Content/Popup → Service Worker
const result = await chrome.runtime.sendMessage({
  action: 'getLibraries',
  payload: { forceRefresh: false }
});

// Service Worker handles and responds
switch (action) {
  case 'getLibraries':
    return await getLibraries(payload?.forceRefresh);
}
```

**Available Actions:**
- `validateToken` - Check if API token is valid
- `getLibraries` - Fetch user's ADS libraries
- `getLibraryDocuments` - Get papers in a library
- `search` - Full-text ADS search
- `exportBibtex` - Generate BibTeX for bibcodes
- `addToLibrary` - Add papers to a library
- `getPreferences` / `setPreferences` - User settings
- `clearCaches` - Clear cached data

### Caching Strategy

- **TTL-based caching** via `storage.js`
- Default: 5 minutes for libraries and documents
- Configurable via `CACHE_CONFIG`
- Manual refresh available via UI

### Rate Limiting

- Built into `ads-api.js`
- Max 10 requests per second
- Automatic retry on 429 responses
- Exponential backoff on network errors

### Editor Integration

Citation insertion uses injected scripts to access Overleaf's editor:
- **CodeMirror 6**: Access view via DOM traversal, use `view.dispatch()`
- **Ace Editor (legacy)**: Use `ace.edit().insert()`
- **Fallback**: Copy to clipboard

## Important Constraints

1. **No Build Tools**: The extension uses vanilla JavaScript with ES modules. No transpilation, bundling, or npm dependencies in production code.

2. **Manifest V3**: Uses Chrome's Manifest V3 with service workers (not background pages).

3. **Security**:
   - API tokens stored locally only (never synced)
   - All API calls via HTTPS
   - Input sanitization for bibcodes
   - CSP restricts scripts to 'self'

4. **Browser Compatibility**:
   - Primary: Chrome/Edge/Brave
   - Supported: Firefox (uses `browser.*` API polyfill)
   - Only works on `www.overleaf.com/project/*`

5. **Overleaf DOM**: The content script is tightly coupled to Overleaf's DOM structure. UI changes in Overleaf may break citation insertion.

## Testing

Currently manual testing only. See `CONTRIBUTING.md` for the testing checklist.

**Areas needing automated tests:**
- `lib/bibtex-utils.js` - Pure functions, highly testable
- `lib/ads-api.js` - Mock fetch, test error handling
- `lib/storage.js` - Mock chrome.storage APIs

## Common Tasks

### Adding a New API Endpoint

1. Add method to `ADSClient` class in `lib/ads-api.js`
2. Add action handler in `background/service-worker.js`
3. Call via `sendMessage()` from content script or popup

### Adding a New User Preference

1. Add default value in `Storage.getPreferences()` in `lib/storage.js`
2. Add UI control in `options/options.html`
3. Add save/load logic in `options/options.js`

### Modifying the Sidebar UI

1. Edit HTML in `createSidebar()` in `content/overleaf-injector.js`
2. Add styles in `styles/overleaf-panel.css`
3. Add event handlers after the HTML is inserted

## Known Limitations

1. **Citation Insertion**: May fail if Overleaf changes their editor DOM structure
2. **No Offline Mode**: Requires active internet connection
3. **Large Libraries**: No pagination for libraries with 100+ papers
4. **Self-hosted Overleaf**: Not supported (only www.overleaf.com)

## File Quick Reference

| File | Lines | Purpose |
|------|-------|---------|
| `content/overleaf-injector.js` | ~700 | Sidebar UI, editor integration |
| `lib/ads-api.js` | ~250 | ADS API client with rate limiting |
| `lib/storage.js` | ~200 | Storage wrapper with caching |
| `lib/bibtex-utils.js` | ~150 | BibTeX utilities |
| `background/service-worker.js` | ~170 | Message routing, API orchestration |
| `styles/overleaf-panel.css` | ~460 | All sidebar styles + dark mode |

## Code Style

- ES6+ JavaScript (async/await, arrow functions, template literals)
- Single quotes for strings
- 2-space indentation
- JSDoc comments for public functions
- Descriptive variable names
- Early returns for error handling

## Architecture Decision Records

See `docs/adr/` for documented architectural decisions:
- ADR-001: Manifest V3 choice
- ADR-002: No build tooling
- ADR-003: Local storage vs sync storage
- ADR-004: Cache strategy
- ADR-005: Content script architecture
