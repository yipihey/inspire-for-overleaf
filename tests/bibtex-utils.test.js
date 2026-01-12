/**
 * Unit Tests for BibTeX Utilities
 */

// Import the module (adjust path as needed for test runner)
// For now, we'll define inline versions that match the implementation

const BibtexUtils = {
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

  getFirstAuthorLastName(doc) {
    if (!doc.author || doc.author.length === 0) return 'Unknown';
    const firstAuthor = doc.author[0];
    const lastName = firstAuthor.split(',')[0].trim();
    return lastName.replace(/[^a-zA-Z]/g, '');
  },

  getJournalAbbrev(doc) {
    if (!doc.bibcode) return '';
    return doc.bibcode.substring(4, 9).replace(/\./g, '').trim();
  },

  formatAuthors(authors, maxAuthors = 3) {
    if (!authors || authors.length === 0) return 'Unknown';
    if (authors.length <= maxAuthors) {
      return authors.join('; ');
    }
    return `${authors.slice(0, maxAuthors).join('; ')} et al.`;
  },

  formatShortCitation(doc) {
    const author = this.getFirstAuthorLastName(doc);
    const year = doc.year || '';
    return `${author} ${year}`;
  },

  formatCiteCommand(bibcode, command = '\\cite') {
    return `${command}{${bibcode}}`;
  },

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

  containsKey(bibtexString, key) {
    const regex = new RegExp(`@\\w+\\{${this.escapeRegex(key)},`, 'i');
    return regex.test(bibtexString);
  },

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  mergeBibtex(existing, newEntries) {
    if (!existing || existing.trim() === '') {
      return newEntries;
    }

    const existingEntries = this.parseBibtex(existing);
    const existingKeys = new Set(existingEntries.map(e => e.key));
    const newParsed = this.parseBibtex(newEntries);
    const toAdd = newParsed.filter(e => !existingKeys.has(e.key));

    if (toAdd.length === 0) {
      return existing;
    }

    return existing.trim() + '\n\n' + toAdd.map(e => e.raw).join('\n\n');
  }
};

// Test Runner
function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error.message}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
  }

  function assertDeepEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
  }

  function assertTrue(value, message = '') {
    if (!value) {
      throw new Error(message || 'Expected true but got false');
    }
  }

  function assertFalse(value, message = '') {
    if (value) {
      throw new Error(message || 'Expected false but got true');
    }
  }

  console.log('\n=== BibtexUtils Tests ===\n');

  // generateKey tests
  console.log('--- generateKey ---');

  test('returns bibcode when format is null', () => {
    const doc = { bibcode: '2024ApJ...100..123A', author: ['Smith, John'] };
    assertEqual(BibtexUtils.generateKey(doc, null), '2024ApJ...100..123A');
  });

  test('returns bibcode when format is "bibcode"', () => {
    const doc = { bibcode: '2024ApJ...100..123A', author: ['Smith, John'] };
    assertEqual(BibtexUtils.generateKey(doc, 'bibcode'), '2024ApJ...100..123A');
  });

  test('formats author:year correctly', () => {
    const doc = { bibcode: '2024ApJ...100..123A', author: ['Smith, John'], year: '2024' };
    assertEqual(BibtexUtils.generateKey(doc, 'author:year'), 'Smith:2024');
  });

  test('formats authoryear correctly', () => {
    const doc = { bibcode: '2024ApJ...100..123A', author: ['Smith, John'], year: '2024' };
    assertEqual(BibtexUtils.generateKey(doc, 'authoryear'), 'Smith2024');
  });

  test('formats author:year:journal correctly', () => {
    const doc = { bibcode: '2024ApJ...100..123A', author: ['Smith, John'], year: '2024' };
    assertEqual(BibtexUtils.generateKey(doc, 'author:year:journal'), 'Smith:2024:ApJ');
  });

  test('handles special characters in author name', () => {
    const doc = { bibcode: '2024ApJ...100..123A', author: ["O'Brien, Jane"], year: '2024' };
    assertEqual(BibtexUtils.generateKey(doc, 'author:year'), 'OBrien:2024');
  });

  // getFirstAuthorLastName tests
  console.log('\n--- getFirstAuthorLastName ---');

  test('extracts last name from standard format', () => {
    const doc = { author: ['Smith, John D.'] };
    assertEqual(BibtexUtils.getFirstAuthorLastName(doc), 'Smith');
  });

  test('returns Unknown for empty author array', () => {
    const doc = { author: [] };
    assertEqual(BibtexUtils.getFirstAuthorLastName(doc), 'Unknown');
  });

  test('returns Unknown for missing author', () => {
    const doc = {};
    assertEqual(BibtexUtils.getFirstAuthorLastName(doc), 'Unknown');
  });

  test('removes special characters from last name', () => {
    const doc = { author: ['García-López, María'] };
    assertEqual(BibtexUtils.getFirstAuthorLastName(doc), 'GarcaLpez');
  });

  // getJournalAbbrev tests
  console.log('\n--- getJournalAbbrev ---');

  test('extracts journal from ApJ bibcode', () => {
    const doc = { bibcode: '2024ApJ...100..123A' };
    assertEqual(BibtexUtils.getJournalAbbrev(doc), 'ApJ');
  });

  test('extracts journal from MNRAS bibcode', () => {
    const doc = { bibcode: '2024MNRAS.500.1234B' };
    assertEqual(BibtexUtils.getJournalAbbrev(doc), 'MNRAS');
  });

  test('returns empty string for missing bibcode', () => {
    const doc = {};
    assertEqual(BibtexUtils.getJournalAbbrev(doc), '');
  });

  // formatAuthors tests
  console.log('\n--- formatAuthors ---');

  test('formats single author', () => {
    const authors = ['Smith, John'];
    assertEqual(BibtexUtils.formatAuthors(authors), 'Smith, John');
  });

  test('formats multiple authors within limit', () => {
    const authors = ['Smith, John', 'Jones, Jane', 'Brown, Bob'];
    assertEqual(BibtexUtils.formatAuthors(authors, 3), 'Smith, John; Jones, Jane; Brown, Bob');
  });

  test('adds et al. when exceeding limit', () => {
    const authors = ['Smith, John', 'Jones, Jane', 'Brown, Bob', 'Wilson, Will'];
    assertEqual(BibtexUtils.formatAuthors(authors, 2), 'Smith, John; Jones, Jane et al.');
  });

  test('returns Unknown for empty authors', () => {
    assertEqual(BibtexUtils.formatAuthors([]), 'Unknown');
    assertEqual(BibtexUtils.formatAuthors(null), 'Unknown');
  });

  // formatCiteCommand tests
  console.log('\n--- formatCiteCommand ---');

  test('formats default cite command', () => {
    assertEqual(BibtexUtils.formatCiteCommand('2024ApJ...100..123A'), '\\cite{2024ApJ...100..123A}');
  });

  test('formats citep command', () => {
    assertEqual(BibtexUtils.formatCiteCommand('2024ApJ...100..123A', '\\citep'), '\\citep{2024ApJ...100..123A}');
  });

  test('formats citet command', () => {
    assertEqual(BibtexUtils.formatCiteCommand('2024ApJ...100..123A', '\\citet'), '\\citet{2024ApJ...100..123A}');
  });

  // parseBibtex tests
  console.log('\n--- parseBibtex ---');

  test('parses single BibTeX entry', () => {
    const bibtex = `@article{Smith2024,
  author = {Smith, John},
  title = {A Great Paper},
  year = {2024}
}`;
    const entries = BibtexUtils.parseBibtex(bibtex);
    assertEqual(entries.length, 1);
    assertEqual(entries[0].type, 'article');
    assertEqual(entries[0].key, 'Smith2024');
  });

  test('parses multiple BibTeX entries', () => {
    const bibtex = `@article{Smith2024,
  author = {Smith, John},
  year = {2024}
}

@inproceedings{Jones2023,
  author = {Jones, Jane},
  year = {2023}
}`;
    const entries = BibtexUtils.parseBibtex(bibtex);
    assertEqual(entries.length, 2);
    assertEqual(entries[0].key, 'Smith2024');
    assertEqual(entries[1].key, 'Jones2023');
  });

  test('returns empty array for empty string', () => {
    const entries = BibtexUtils.parseBibtex('');
    assertEqual(entries.length, 0);
  });

  // containsKey tests
  console.log('\n--- containsKey ---');

  test('finds existing key', () => {
    const bibtex = '@article{Smith2024, author = {Smith}}';
    assertTrue(BibtexUtils.containsKey(bibtex, 'Smith2024'));
  });

  test('returns false for missing key', () => {
    const bibtex = '@article{Smith2024, author = {Smith}}';
    assertFalse(BibtexUtils.containsKey(bibtex, 'Jones2023'));
  });

  test('handles special characters in key', () => {
    const bibtex = '@article{Smith:2024:ApJ, author = {Smith}}';
    assertTrue(BibtexUtils.containsKey(bibtex, 'Smith:2024:ApJ'));
  });

  // mergeBibtex tests
  console.log('\n--- mergeBibtex ---');

  test('returns new entries when existing is empty', () => {
    const newEntries = '@article{Smith2024, author = {Smith}}';
    assertEqual(BibtexUtils.mergeBibtex('', newEntries), newEntries);
  });

  test('appends non-duplicate entries', () => {
    const existing = '@article{Smith2024, author = {Smith}}';
    const newEntries = '@article{Jones2023, author = {Jones}}';
    const merged = BibtexUtils.mergeBibtex(existing, newEntries);
    assertTrue(merged.includes('Smith2024'));
    assertTrue(merged.includes('Jones2023'));
  });

  test('does not duplicate existing entries', () => {
    const existing = '@article{Smith2024, author = {Smith}}';
    const newEntries = '@article{Smith2024, author = {Smith Updated}}';
    const merged = BibtexUtils.mergeBibtex(existing, newEntries);
    assertEqual(merged, existing);
  });

  // escapeRegex tests
  console.log('\n--- escapeRegex ---');

  test('escapes special regex characters', () => {
    assertEqual(BibtexUtils.escapeRegex('a.b*c?d'), 'a\\.b\\*c\\?d');
    assertEqual(BibtexUtils.escapeRegex('test[1]'), 'test\\[1\\]');
    assertEqual(BibtexUtils.escapeRegex('foo(bar)'), 'foo\\(bar\\)');
  });

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  return failed === 0;
}

// Run tests if executed directly
if (typeof window === 'undefined') {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests, BibtexUtils };
