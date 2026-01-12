/**
 * BibTeX to ADS Resolution Logic
 *
 * Resolves BibTeX entries to ADS bibcodes using multiple search strategies:
 * 1. Direct bibcode match (if present in entry)
 * 2. DOI search (most reliable)
 * 3. arXiv ID search (very reliable)
 * 4. Title + Author search (fallback)
 */

import { BibtexUtils } from './shared-import.js';

/**
 * Result of resolving a single BibTeX entry
 */
/**
 * @typedef {Object} ResolutionResult
 * @property {string} citeKey - Original cite key from BibTeX
 * @property {string} entryType - BibTeX entry type
 * @property {string|null} bibcode - Resolved ADS bibcode (null if not found)
 * @property {string} method - How it was resolved: 'bibcode', 'doi', 'arxiv', 'title', or 'not_found'
 * @property {number} confidence - Confidence score 0-1
 * @property {Object} [document] - ADS document if found
 * @property {string} [error] - Error message if resolution failed
 */

/**
 * Resolve a single BibTeX entry to an ADS bibcode
 *
 * @param {Object} entry - Parsed BibTeX entry with citeKey, entryType, fields
 * @param {Function} searchFn - Function to search ADS: (query, rows) => Promise<{documents, numFound}>
 * @returns {Promise<ResolutionResult>} Resolution result
 */
export async function resolveEntry(entry, searchFn) {
  const identifiers = BibtexUtils.extractIdentifiers(entry);
  const result = {
    citeKey: entry.citeKey,
    entryType: entry.entryType,
    bibcode: null,
    method: 'not_found',
    confidence: 0,
    fields: entry.fields,
  };

  try {
    // 1. Direct bibcode match
    if (identifiers.bibcode) {
      const searchResult = await searchFn(`bibcode:"${identifiers.bibcode}"`, 1);
      if (searchResult.numFound === 1) {
        result.bibcode = searchResult.documents[0].bibcode;
        result.method = 'bibcode';
        result.confidence = 1.0;
        result.document = searchResult.documents[0];
        return result;
      }
    }

    // 2. DOI search (most reliable)
    if (identifiers.doi) {
      const searchResult = await searchFn(`doi:"${identifiers.doi}"`, 1);
      if (searchResult.numFound === 1) {
        result.bibcode = searchResult.documents[0].bibcode;
        result.method = 'doi';
        result.confidence = 0.99;
        result.document = searchResult.documents[0];
        return result;
      }
    }

    // 3. arXiv search (very reliable)
    if (identifiers.arxivId) {
      const searchResult = await searchFn(`identifier:arXiv:${identifiers.arxivId}`, 1);
      if (searchResult.numFound === 1) {
        result.bibcode = searchResult.documents[0].bibcode;
        result.method = 'arxiv';
        result.confidence = 0.98;
        result.document = searchResult.documents[0];
        return result;
      }
    }

    // 4. Title + Author search (fallback)
    const title = entry.fields.title;
    const author = entry.fields.author;
    const year = entry.fields.year;

    if (title && author) {
      const query = buildTitleAuthorQuery(title, author, year);
      const searchResult = await searchFn(query, 5);

      if (searchResult.numFound >= 1) {
        // Find best match
        const match = findBestMatch(entry, searchResult.documents);
        if (match) {
          result.bibcode = match.document.bibcode;
          result.method = 'title';
          result.confidence = match.confidence;
          result.document = match.document;
          return result;
        }
      }
    }

    // Not found
    return result;

  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Resolve multiple BibTeX entries with progress reporting
 *
 * @param {Array} entries - Array of parsed BibTeX entries
 * @param {Function} searchFn - Search function
 * @param {Function} [onProgress] - Progress callback: (current, total, result) => void
 * @param {number} [delayMs=100] - Delay between requests to avoid rate limiting
 * @returns {Promise<Array<ResolutionResult>>} Array of resolution results
 */
export async function resolveEntries(entries, searchFn, onProgress, delayMs = 100) {
  const results = [];

  for (let i = 0; i < entries.length; i++) {
    const result = await resolveEntry(entries[i], searchFn);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, entries.length, result);
    }

    // Delay between requests to avoid rate limiting
    if (i < entries.length - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return results;
}

/**
 * Build a title + author ADS query
 *
 * @param {string} title - Paper title
 * @param {string} author - BibTeX author string
 * @param {string} [year] - Publication year
 * @returns {string} ADS query string
 */
function buildTitleAuthorQuery(title, author, year) {
  // Clean title: remove braces and quotes
  const cleanTitle = title
    .replace(/[{}]/g, '')
    .replace(/"/g, '')
    .trim();

  // Extract first author's last name
  const firstAuthorMatch = author.match(/^([^,]+)/);
  const firstAuthor = firstAuthorMatch
    ? firstAuthorMatch[1].replace(/[{}]/g, '').trim()
    : '';

  // Build query
  let query = `title:"${cleanTitle}"`;

  if (firstAuthor) {
    query += ` author:"${firstAuthor}"`;
  }

  if (year) {
    query += ` year:${year}`;
  }

  return query;
}

/**
 * Find the best matching document from search results
 *
 * @param {Object} entry - BibTeX entry
 * @param {Array} documents - ADS documents from search
 * @returns {Object|null} Best match with confidence, or null
 */
function findBestMatch(entry, documents) {
  const entryTitle = normalizeTitle(entry.fields.title || '');
  const entryYear = entry.fields.year;

  let bestMatch = null;
  let bestScore = 0;

  for (const doc of documents) {
    const docTitle = normalizeTitle(
      Array.isArray(doc.title) ? doc.title[0] : doc.title || ''
    );

    // Calculate title similarity (simple Jaccard similarity)
    const similarity = calculateTitleSimilarity(entryTitle, docTitle);

    // Year match bonus
    let score = similarity;
    if (entryYear && doc.year && parseInt(entryYear) === doc.year) {
      score += 0.1;
    }

    if (score > bestScore && similarity > 0.5) {
      bestScore = score;
      bestMatch = {
        document: doc,
        confidence: Math.min(similarity, 0.9), // Cap at 0.9 for title matches
      };
    }
  }

  return bestMatch;
}

/**
 * Normalize a title for comparison
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[{}\\$^_]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate title similarity using word-based Jaccard similarity
 */
function calculateTitleSimilarity(title1, title2) {
  const words1 = new Set(title1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(title2.split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Simple delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Categorize resolution results
 *
 * @param {Array<ResolutionResult>} results - Resolution results
 * @returns {Object} Categorized results
 */
export function categorizeResults(results) {
  const found = results.filter(r => r.bibcode !== null);
  const notFound = results.filter(r => r.bibcode === null);
  const errors = results.filter(r => r.error);

  return {
    found,
    notFound,
    errors,
    stats: {
      total: results.length,
      foundCount: found.length,
      notFoundCount: notFound.length,
      errorCount: errors.length,
      byMethod: {
        bibcode: found.filter(r => r.method === 'bibcode').length,
        doi: found.filter(r => r.method === 'doi').length,
        arxiv: found.filter(r => r.method === 'arxiv').length,
        title: found.filter(r => r.method === 'title').length,
      },
    },
  };
}
