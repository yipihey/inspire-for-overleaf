#!/usr/bin/env node
/**
 * Simple Test Runner
 * Runs all test files in the tests directory
 *
 * Usage: node tests/run-tests.js
 */

import { runTests as runBibtexTests } from './bibtex-utils.test.js';
import { runTests as runAdsApiTests } from './ads-api.test.js';
import { runTests as runStorageTests } from './storage.test.js';

async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║   ADS for Overleaf Test Suite      ║');
  console.log('╚════════════════════════════════════╝\n');

  const results = [];

  console.log('Running BibTeX Utils tests...');
  results.push({ name: 'BibTeX Utils', success: runBibtexTests() });

  console.log('\nRunning ADS API tests...');
  results.push({ name: 'ADS API', success: await runAdsApiTests() });

  console.log('\nRunning Storage tests...');
  results.push({ name: 'Storage', success: await runStorageTests() });

  // Final summary
  console.log('\n╔════════════════════════════════════╗');
  console.log('║        Final Summary               ║');
  console.log('╠════════════════════════════════════╣');

  let allPassed = true;
  for (const result of results) {
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    console.log(`║ ${result.name.padEnd(20)} ${status.padEnd(12)} ║`);
    if (!result.success) allPassed = false;
  }

  console.log('╚════════════════════════════════════╝');

  if (allPassed) {
    console.log('\n✓ All test suites passed!\n');
  } else {
    console.log('\n✗ Some tests failed. See details above.\n');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
