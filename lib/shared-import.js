/**
 * Shared Library Integration for INSPIRE
 *
 * This file provides the INSPIRE API client and BibTeX utilities
 * for the INSPIRE for Overleaf extension.
 */

// Import INSPIRE client and storage
import { INSPIREClient, INSPIREError, RATE_LIMIT } from './inspire-api.js';
import { Storage, CACHE_CONFIG } from './storage.js';

// Re-export Storage
export { Storage, CACHE_CONFIG, RATE_LIMIT };

// ============================================================================
// BibtexUtils - Local implementation for parsing and utilities
// ============================================================================

const BibtexUtils = {
  /**
   * Generate a citation key from document metadata
   * For INSPIRE, we use Author:Year format by default
   */
  generateKey(doc, format = 'authoryear') {
    const firstAuthor = this.getFirstAuthorLastName(doc);
    const year = doc.year || '';

    switch (format) {
      case 'author:year':
        return `${firstAuthor}:${year}`;
      case 'authoryear':
        return `${firstAuthor}${year}`;
      case 'recid':
        return doc.recid || doc.bibcode || `${firstAuthor}${year}`;
      default:
        return `${firstAuthor}:${year}`;
    }
  },

  /**
   * Extract first author's last name
   */
  getFirstAuthorLastName(doc) {
    const authors = Array.isArray(doc) ? doc : (doc.author || []);
    if (!authors || authors.length === 0) return 'Unknown';

    const firstAuthor = authors[0];
    // Format: "Last, First M."
    const lastName = firstAuthor.split(',')[0].trim();
    // Remove any special characters
    return lastName.replace(/[^a-zA-Z]/g, '');
  },

  /**
   * Format authors for display
   */
  formatAuthors(authors, maxAuthors = 3) {
    if (!authors || authors.length === 0) return 'Unknown';

    if (authors.length <= maxAuthors) {
      return authors.join('; ');
    }

    return `${authors.slice(0, maxAuthors).join('; ')} et al.`;
  },

  /**
   * Format a short citation string
   */
  formatShortCitation(doc) {
    const author = this.getFirstAuthorLastName(doc);
    const year = doc.year || '';
    return `${author} ${year}`;
  },

  /**
   * Format a citation command
   */
  formatCiteCommand(citeKey, command = '\\cite') {
    return `${command}{${citeKey}}`;
  },

  /**
   * Parse a BibTeX string and extract entries with full field information
   * @param {string} bibtexString - Raw BibTeX content
   * @returns {Array} Array of parsed entries with citeKey, entryType, fields, raw
   */
  parseBibtex(bibtexString) {
    const entries = [];
    if (!bibtexString) return entries;

    // Match BibTeX entries: @type{key, ... }
    // This regex handles nested braces properly
    const entryStartRegex = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
    let match;

    while ((match = entryStartRegex.exec(bibtexString)) !== null) {
      const entryType = match[1].toLowerCase();
      const citeKey = match[2].trim();
      const startPos = match.index;

      // Find the matching closing brace
      let braceCount = 1;
      let pos = match.index + match[0].length;
      while (pos < bibtexString.length && braceCount > 0) {
        if (bibtexString[pos] === '{') braceCount++;
        else if (bibtexString[pos] === '}') braceCount--;
        pos++;
      }

      const rawEntry = bibtexString.substring(startPos, pos);
      const fieldsContent = bibtexString.substring(match.index + match[0].length, pos - 1);
      const fields = this.parseFields(fieldsContent);

      entries.push({
        type: entryType,
        key: citeKey,
        entryType: entryType,
        citeKey: citeKey,
        fields: fields,
        raw: rawEntry,
      });
    }

    return entries;
  },

  /**
   * Parse fields from a BibTeX entry content
   * @param {string} content - The content between entry braces (after the key)
   * @returns {Object} Field name -> value mapping
   */
  parseFields(content) {
    const fields = {};

    // Simple field regex for quoted or numeric values
    const simpleFieldRegex = /(\w+)\s*=\s*(?:"([^"]*)"|(\d+)(?![.\d]))/g;
    let match;
    while ((match = simpleFieldRegex.exec(content)) !== null) {
      const fieldName = match[1].toLowerCase();
      const value = match[2] ?? match[3] ?? '';
      fields[fieldName] = value.trim();
    }

    // Handle brace-delimited fields with proper brace matching
    const braceFieldRegex = /(\w+)\s*=\s*\{/g;
    while ((match = braceFieldRegex.exec(content)) !== null) {
      const fieldName = match[1].toLowerCase();
      const startPos = match.index + match[0].length;

      // Find matching closing brace
      let braceCount = 1;
      let pos = startPos;
      while (pos < content.length && braceCount > 0) {
        if (content[pos] === '{') braceCount++;
        else if (content[pos] === '}') braceCount--;
        pos++;
      }

      if (braceCount === 0) {
        const value = content.substring(startPos, pos - 1);
        fields[fieldName] = value.trim();
      }
    }

    return fields;
  },

  /**
   * Parse BibTeX and convert to display format
   * Returns entries suitable for the sidebar display
   */
  parseBibtexForDisplay(bibtexString) {
    const entries = this.parseBibtex(bibtexString);

    return entries.map(entry => {
      const fields = entry.fields;

      // Extract authors into array format
      let authors = [];
      if (fields.author) {
        // Split by " and " to get individual authors
        authors = fields.author.split(/\s+and\s+/i).map(a => a.trim());
      }

      // Extract year
      let year = null;
      if (fields.year) {
        year = parseInt(fields.year, 10);
      }

      return {
        citeKey: entry.citeKey,
        bibcode: entry.citeKey, // Use cite key as identifier
        title: [fields.title || 'Untitled'],
        author: authors,
        year: year,
        pub: fields.journal || fields.booktitle || fields.publisher || null,
        doi: fields.doi ? [fields.doi] : undefined,
        arxivId: fields.eprint || null,
        entryType: entry.entryType,
        raw: entry.raw,
      };
    });
  },

  /**
   * Check if a BibTeX string contains a specific key
   */
  containsKey(bibtexString, key) {
    const regex = new RegExp(`@\\w+\\{${this.escapeRegex(key)},`, 'i');
    return regex.test(bibtexString);
  },

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Merge new BibTeX entries with existing content
   */
  mergeBibtex(existing, newEntries) {
    if (!existing || existing.trim() === '') {
      return newEntries;
    }

    // Parse existing to find keys
    const existingEntries = this.parseBibtex(existing);
    const existingKeys = new Set(existingEntries.map(e => e.citeKey));

    // Parse new entries
    const newParsed = this.parseBibtex(newEntries);

    // Filter out duplicates
    const toAdd = newParsed.filter(e => !existingKeys.has(e.citeKey));

    if (toAdd.length === 0) {
      return existing;
    }

    // Append new entries
    return existing.trim() + '\n\n' + toAdd.map(e => e.raw).join('\n\n');
  },

  /**
   * Extract identifiers (DOI, arXiv, etc.) from a parsed BibTeX entry
   * @param {Object} entry - Parsed BibTeX entry with fields
   * @returns {Object} Object with doi, arxivId, etc.
   */
  extractIdentifiers(entry) {
    const fields = entry.fields || {};
    const identifiers = {};

    // Extract DOI
    if (fields.doi) {
      identifiers.doi = fields.doi.replace(/^https?:\/\/doi\.org\//i, '');
    }

    // Extract arXiv ID
    if (fields.eprint) {
      identifiers.arxivId = fields.eprint.replace(/^arXiv:/i, '');
    } else if (fields.arxivid) {
      identifiers.arxivId = fields.arxivid.replace(/^arXiv:/i, '');
    }

    // Check for INSPIRE recid in note or other fields
    if (fields.note && fields.note.includes('inspirehep.net')) {
      const match = fields.note.match(/inspirehep\.net\/(?:record|literature)\/(\d+)/);
      if (match) {
        identifiers.recid = match[1];
      }
    }

    return identifiers;
  },
};

// ============================================================================
// Exports
// ============================================================================

export {
  INSPIREClient,
  INSPIREError,
  BibtexUtils,
};
