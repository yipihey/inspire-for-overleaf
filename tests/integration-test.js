/**
 * Integration Test for Shared Library
 * Tests that the shared-import.js correctly integrates with shared-ads-lib
 */

import {
  ADSClient,
  ADSError,
  BibtexUtils,
  RATE_LIMIT,
  generateCiteKey,
  formatCiteCommand,
  containsKey,
} from '../lib/shared-import.js';

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

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) throw new Error(msg || 'Expected true');
}

console.log('\n=== Integration Tests: shared-import.js ===\n');

// Test ADSClient adapter
console.log('--- ADSClient Adapter ---');

test('ADSClient constructor accepts token string', () => {
  const client = new ADSClient('test-token');
  assertTrue(client._client !== undefined, 'Should wrap SharedADSClient');
});

test('ADSClient has sanitizeBibcode method', () => {
  const client = new ADSClient('test-token');
  assertEqual(client.sanitizeBibcode('2024ApJ...100..123A'), '2024ApJ...100..123A');
  // Sanitize removes invalid chars but keeps valid alphanumeric
  assertEqual(client.sanitizeBibcode('<script>'), 'script');
  assertEqual(client.sanitizeBibcode('2024A&A...100..123A'), '2024A&A...100..123A');
});

// Test BibtexUtils adapter
console.log('\n--- BibtexUtils Adapter ---');

test('BibtexUtils.generateKey works with ADS doc format', () => {
  const doc = { author: ['Einstein, Albert'], year: 1905, bibcode: '1905AnP...322..891E' };
  assertEqual(BibtexUtils.generateKey(doc, 'bibcode'), '1905AnP...322..891E');
  assertEqual(BibtexUtils.generateKey(doc, 'author:year'), 'Einstein:1905');
  assertEqual(BibtexUtils.generateKey(doc, 'authoryear'), 'Einstein1905');
});

test('BibtexUtils.getFirstAuthorLastName works with doc object', () => {
  const doc = { author: ['Smith, John', 'Jones, Jane'] };
  assertEqual(BibtexUtils.getFirstAuthorLastName(doc), 'Smith');
});

test('BibtexUtils.getFirstAuthorLastName handles empty authors', () => {
  assertEqual(BibtexUtils.getFirstAuthorLastName({ author: [] }), 'Unknown');
  assertEqual(BibtexUtils.getFirstAuthorLastName({}), 'Unknown');
});

test('BibtexUtils.formatAuthors works correctly', () => {
  const authors = ['Smith, John', 'Jones, Jane', 'Brown, Bob'];
  assertEqual(BibtexUtils.formatAuthors(authors, 2), 'Smith, John; Jones, Jane et al.');
});

test('BibtexUtils.formatCiteCommand works', () => {
  assertEqual(BibtexUtils.formatCiteCommand('Einstein1905'), '\\cite{Einstein1905}');
  assertEqual(BibtexUtils.formatCiteCommand('Einstein1905', '\\citep'), '\\citep{Einstein1905}');
});

test('BibtexUtils.parseBibtex returns compatible format', () => {
  const bibtex = '@article{Smith2024,\n  author = {John Smith},\n  title = {Test}\n}';
  const entries = BibtexUtils.parseBibtex(bibtex);
  assertEqual(entries.length, 1);
  assertEqual(entries[0].key, 'Smith2024');
  assertEqual(entries[0].type, 'article');
  assertTrue(entries[0].raw !== undefined, 'Should have raw property');
});

test('BibtexUtils.containsKey works', () => {
  const bibtex = '@article{Smith2024, author={Smith}}';
  assertTrue(BibtexUtils.containsKey(bibtex, 'Smith2024'));
  assertTrue(!BibtexUtils.containsKey(bibtex, 'Jones2024'));
});

test('BibtexUtils.mergeBibtex works', () => {
  const existing = '@article{A, author={A}}';
  const newEntry = '@article{B, author={B}}';
  const merged = BibtexUtils.mergeBibtex(existing, newEntry);
  assertTrue(merged.includes('A'));
  assertTrue(merged.includes('B'));
});

// Test direct exports
console.log('\n--- Direct Exports ---');

test('generateCiteKey is exported', () => {
  const paper = { authors: ['Smith, John'], year: 2024, bibcode: '2024Test' };
  assertEqual(generateCiteKey(paper, 'bibcode'), '2024Test');
});

test('formatCiteCommand is exported', () => {
  assertEqual(formatCiteCommand('Key123'), '\\cite{Key123}');
});

test('containsKey is exported', () => {
  assertTrue(containsKey('@article{Test, a=b}', 'Test'));
});

test('RATE_LIMIT is exported', () => {
  assertTrue(RATE_LIMIT.maxRequests !== undefined);
  assertTrue(RATE_LIMIT.windowMs !== undefined);
});

test('ADSError is exported', () => {
  const error = new ADSError('test error', 'TEST_CODE');
  assertEqual(error.name, 'ADSError');
});

// Summary
console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed === 0 ? 0 : 1);
