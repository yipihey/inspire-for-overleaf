/**
 * Background Service Worker
 * Handles ADS API requests and message passing
 */

// ES Module imports from shared library
import { ADSClient, ADSError, Storage, BibtexUtils } from '../lib/shared-import.js';

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const { action, payload } = message;

  switch (action) {
    case 'validateToken':
      return await validateToken(payload.token);

    case 'getLibraries':
      return await getLibraries(payload?.forceRefresh);

    case 'getLibraryDocuments':
      return await getLibraryDocuments(payload.libraryId, payload.forceRefresh);

    case 'search':
      return await search(payload.query, payload.rows, payload.start);

    case 'exportBibtex':
      return await exportBibtex(payload.bibcodes, payload.options);

    case 'addToLibrary':
      return await addToLibrary(payload.libraryId, payload.bibcodes);

    case 'getPreferences':
      return await Storage.getPreferences();

    case 'setPreferences':
      await Storage.setPreferences(payload);
      return { success: true };

    case 'clearCaches':
      await Storage.clearCaches();
      return { success: true };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Get an authenticated ADS client
 */
async function getClient() {
  const token = await Storage.getToken();
  if (!token) {
    throw new Error('ADS API token not configured. Please set your token in the extension options.');
  }
  return new ADSClient(token);
}

/**
 * Validate an API token
 */
async function validateToken(token) {
  const client = new ADSClient(token);
  const result = await client.validateToken();
  
  if (result.valid) {
    await Storage.setToken(token);
  }
  
  return result;
}

/**
 * Get user's ADS libraries
 */
async function getLibraries(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await Storage.getCachedLibraries();
    if (cached) {
      return { libraries: cached, fromCache: true };
    }
  }

  const client = await getClient();
  const libraries = await client.getLibraries();
  
  await Storage.setCachedLibraries(libraries);
  
  return { libraries, fromCache: false };
}

/**
 * Get documents from a library
 */
async function getLibraryDocuments(libraryId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await Storage.getCachedLibraryDocs(libraryId);
    if (cached) {
      return { documents: cached, fromCache: true };
    }
  }

  const client = await getClient();
  const result = await client.getLibraryDocuments(libraryId);
  
  await Storage.setCachedLibraryDocs(libraryId, result.documents);
  
  return { documents: result.documents, fromCache: false };
}

/**
 * Search ADS
 */
async function search(query, rows = 20, start = 0) {
  const client = await getClient();
  return await client.search(query, rows, start);
}

/**
 * Export bibcodes to BibTeX
 */
async function exportBibtex(bibcodes, options = {}) {
  const client = await getClient();
  const bibtex = await client.exportBibtex(bibcodes, options);
  return { bibtex };
}

/**
 * Add papers to a library
 */
async function addToLibrary(libraryId, bibcodes) {
  const client = await getClient();
  const result = await client.addToLibrary(libraryId, bibcodes);
  
  // Clear cache for this library
  await Storage.remove([`libDocs_${libraryId}`, `libDocsTime_${libraryId}`]);
  
  return result;
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-citation-picker') {
    // Send message to active Overleaf tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url?.includes('overleaf.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'openCitationPicker' });
      }
    });
  }
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

console.log('ADS for Overleaf service worker initialized');
