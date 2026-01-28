/**
 * Background Service Worker
 * Handles INSPIRE API requests and message passing
 */

// ES Module imports from shared library
import { INSPIREClient, INSPIREError, Storage, BibtexUtils } from '../lib/shared-import.js';
import { resolveEntries, categorizeResults } from '../lib/bibtex-resolver.js';

// Singleton INSPIRE client (no auth required)
let client = null;

function getClient() {
  if (!client) {
    client = new INSPIREClient();
  }
  return client;
}

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
    // Search INSPIRE
    case 'search':
      return await search(payload.query, payload.rows, payload.page);

    // Export BibTeX for record IDs
    case 'exportBibtex':
      return await exportBibtex(payload.recids || payload.bibcodes);

    // Lookup by DOI
    case 'lookupByDOI':
      return await lookupByDOI(payload.doi);

    // Lookup by arXiv ID
    case 'lookupByArxiv':
      return await lookupByArxiv(payload.arxivId);

    // Get single record
    case 'getRecord':
      return await getRecord(payload.recid);

    // Resolve BibTeX to INSPIRE records
    case 'resolveBibtex':
      return await resolveBibtex(payload.bibtexContent);

    // Get cached .bib file content
    case 'getBibFile':
      return await Storage.getBibFileContent();

    // Set cached .bib file content
    case 'setBibFile':
      await Storage.setBibFileContent(payload.content, payload.fileName);
      return { success: true };

    // Get parsed papers from .bib file
    case 'getParsedPapers':
      return await getParsedPapers();

    // Parse .bib content and cache it
    case 'parseBibFile':
      return await parseBibFile(payload.content, payload.fileName);

    // Clear .bib file cache
    case 'clearBibFile':
      await Storage.clearBibFile();
      return { success: true };

    // Add a single paper to the cached papers
    case 'addPaperToCache':
      return await addPaperToCache(payload.paper);

    // User preferences
    case 'getPreferences':
      return await Storage.getPreferences();

    case 'setPreferences':
      await Storage.setPreferences(payload);
      return { success: true };

    // Clear all caches
    case 'clearCaches':
      await Storage.clearCaches();
      return { success: true };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Search INSPIRE
 */
async function search(query, rows = 20, page = 1) {
  const inspireClient = getClient();
  return await inspireClient.search(query, rows, page);
}

/**
 * Export BibTeX for record IDs
 */
async function exportBibtex(recids) {
  const inspireClient = getClient();
  const bibtex = await inspireClient.exportBibtex(recids);
  return { bibtex };
}

/**
 * Lookup by DOI
 */
async function lookupByDOI(doi) {
  const inspireClient = getClient();
  const doc = await inspireClient.lookupByDOI(doi);
  return { document: doc };
}

/**
 * Lookup by arXiv ID
 */
async function lookupByArxiv(arxivId) {
  const inspireClient = getClient();
  const doc = await inspireClient.lookupByArxiv(arxivId);
  return { document: doc };
}

/**
 * Get a single record by recid
 */
async function getRecord(recid) {
  const inspireClient = getClient();
  const doc = await inspireClient.getRecord(recid);
  return { document: doc };
}

/**
 * Get parsed papers from cache
 */
async function getParsedPapers() {
  const papers = await Storage.getParsedPapers();
  return { papers: papers || [] };
}

/**
 * Add a single paper to the cached papers
 */
async function addPaperToCache(paper) {
  const papers = await Storage.getParsedPapers() || [];

  // Check if already exists
  const exists = papers.some(p =>
    p.citeKey === paper.citeKey || p.bibcode === paper.citeKey
  );

  if (!exists) {
    papers.push(paper);
    await Storage.setParsedPapers(papers);
  }

  return { success: true, count: papers.length };
}

/**
 * Parse .bib file content and cache it
 */
async function parseBibFile(content, fileName) {
  // Store the raw content
  await Storage.setBibFileContent(content, fileName);

  // Parse into display format
  const papers = BibtexUtils.parseBibtexForDisplay(content);

  // Cache parsed papers
  await Storage.setParsedPapers(papers);

  return { papers, count: papers.length };
}

/**
 * Resolve BibTeX entries to INSPIRE records
 * @param {string} bibtexContent - Raw BibTeX content
 * @returns {Object} Resolution results with found/notFound categorization
 */
async function resolveBibtex(bibtexContent) {
  const inspireClient = getClient();

  // Parse BibTeX content
  const entries = BibtexUtils.parseBibtex(bibtexContent);

  if (entries.length === 0) {
    return {
      results: [],
      categorized: {
        found: [],
        notFound: [],
        errors: [],
        stats: { total: 0, foundCount: 0, notFoundCount: 0, errorCount: 0, byMethod: {} },
      },
    };
  }

  // Convert parsed entries to format expected by resolver
  const normalizedEntries = entries.map(entry => ({
    citeKey: entry.citeKey,
    entryType: entry.entryType,
    fields: entry.fields,
  }));

  // Resolve entries
  const results = await resolveEntries(normalizedEntries, inspireClient, null, 150);

  // Categorize results
  const categorized = categorizeResults(results);

  return { results, categorized };
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
    // Open options page on first install (optional for INSPIRE since no token needed)
    // For now, just log that we're installed
    console.log('INSPIRE for Overleaf installed');
  }
});

console.log('INSPIRE for Overleaf service worker initialized');
