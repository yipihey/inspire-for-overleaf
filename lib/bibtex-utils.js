/**
 * BibTeX utilities
 * Helper functions for working with BibTeX data
 */

const BibtexUtils = {
  /**
   * Generate a citation key from document metadata
   */
  generateKey(doc, format = 'bibcode') {
    if (format === 'bibcode' || !format) {
      return doc.bibcode;
    }

    const firstAuthor = this.getFirstAuthorLastName(doc);
    const year = doc.year || '';

    switch (format) {
      case 'author:year':
        return `${firstAuthor}:${year}`;
      case 'authoryear':
        return `${firstAuthor}${year}`;
      case 'author:year:journal':
        const journal = this.getJournalAbbrev(doc);
        return `${firstAuthor}:${year}:${journal}`;
      default:
        return doc.bibcode;
    }
  },

  /**
   * Extract first author's last name
   */
  getFirstAuthorLastName(doc) {
    if (!doc.author || doc.author.length === 0) return 'Unknown';
    
    const firstAuthor = doc.author[0];
    // ADS format: "Last, First M."
    const lastName = firstAuthor.split(',')[0].trim();
    // Remove any special characters
    return lastName.replace(/[^a-zA-Z]/g, '');
  },

  /**
   * Get journal abbreviation from bibcode
   */
  getJournalAbbrev(doc) {
    if (!doc.bibcode) return '';
    // Bibcode format: YYYYJJJJJVVVVMPPPPa
    // Journal is chars 4-8
    return doc.bibcode.substring(4, 9).replace(/\./g, '').trim();
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
  formatCiteCommand(bibcode, command = '\\cite') {
    return `${command}{${bibcode}}`;
  },

  /**
   * Parse a BibTeX string and extract entries
   */
  parseBibtex(bibtexString) {
    const entries = [];
    const entryRegex = /@(\w+)\{([^,]+),([^@]*)/g;
    
    let match;
    while ((match = entryRegex.exec(bibtexString)) !== null) {
      const type = match[1];
      const key = match[2].trim();
      const content = match[3];
      
      entries.push({
        type,
        key,
        raw: `@${type}{${key},${content}}`
      });
    }
    
    return entries;
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
    const existingKeys = new Set(existingEntries.map(e => e.key));

    // Parse new entries
    const newParsed = this.parseBibtex(newEntries);

    // Filter out duplicates
    const toAdd = newParsed.filter(e => !existingKeys.has(e.key));

    if (toAdd.length === 0) {
      return existing;
    }

    // Append new entries
    return existing.trim() + '\n\n' + toAdd.map(e => e.raw).join('\n\n');
  }
};

// ES Module exports (for service worker with type: module)
export { BibtexUtils };
