/**
 * Unit Tests for ADS API Client
 */

// Mock implementation for testing
class ADSError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ADSError';
    this.status = status;
  }
}

// Simplified ADSClient for testing (without rate limiter for unit tests)
class ADSClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://api.adsabs.harvard.edu/v1';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ADSError(
          error.error || `HTTP ${response.status}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ADSError) throw error;
      throw new ADSError(`Network error: ${error.message}`, 0);
    }
  }

  sanitizeBibcode(bibcode) {
    if (typeof bibcode !== 'string') return '';
    return bibcode.replace(/[^a-zA-Z0-9.&]/g, '');
  }

  async getLibraries() {
    const data = await this.request('/biblib/libraries');
    return data.libraries || [];
  }

  async search(query, rows = 20, start = 0, sort = 'date desc') {
    const params = new URLSearchParams({
      q: query,
      fl: 'bibcode,title,author,year,pub,abstract,doi,identifier,doctype,citation_count,read_count',
      rows: rows.toString(),
      start: start.toString(),
      sort
    });

    const data = await this.request(`/search/query?${params}`);

    return {
      documents: data.response?.docs || [],
      numFound: data.response?.numFound || 0
    };
  }

  async exportBibtex(bibcodes, options = {}) {
    const {
      keyFormat = null,
      maxAuthor = 10,
      authorCutoff = 200,
      journalFormat = 1
    } = options;

    const body = {
      bibcode: bibcodes
    };

    if (keyFormat) body.keyformat = keyFormat;
    if (maxAuthor !== 10) body.maxauthor = maxAuthor;
    if (authorCutoff !== 200) body.authorcutoff = authorCutoff;
    if (journalFormat !== 1) body.journalformat = journalFormat;

    const data = await this.request('/export/bibtex', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return data.export || '';
  }
}

// Mock fetch helper
function mockFetch(responseData, options = {}) {
  const { status = 200, ok = true } = options;

  globalThis.fetch = async (url, fetchOptions) => {
    // Store last request for assertions
    mockFetch.lastRequest = { url, options: fetchOptions };

    return {
      ok,
      status,
      json: async () => responseData
    };
  };
}

function mockFetchError(errorMessage) {
  globalThis.fetch = async () => {
    throw new Error(errorMessage);
  };
}

// Test Runner
function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`✓ ${name}`);
        passed++;
      } catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        failed++;
      }
    })();
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

  async function assertThrows(fn, expectedErrorType, message = '') {
    try {
      await fn();
      throw new Error(message || 'Expected function to throw');
    } catch (error) {
      if (expectedErrorType && error.name !== expectedErrorType) {
        throw new Error(`Expected ${expectedErrorType} but got ${error.name}: ${error.message}`);
      }
    }
  }

  console.log('\n=== ADSClient Tests ===\n');

  // Constructor tests
  console.log('--- Constructor ---');

  test('stores token', () => {
    const client = new ADSClient('test-token');
    assertEqual(client.token, 'test-token');
  });

  // sanitizeBibcode tests
  console.log('\n--- sanitizeBibcode ---');

  test('passes through valid bibcode', () => {
    const client = new ADSClient('token');
    assertEqual(client.sanitizeBibcode('2024ApJ...100..123A'), '2024ApJ...100..123A');
  });

  test('removes invalid characters', () => {
    const client = new ADSClient('token');
    assertEqual(client.sanitizeBibcode('2024ApJ<script>alert(1)</script>'), '2024ApJscriptalert1script');
  });

  test('preserves dots and ampersands', () => {
    const client = new ADSClient('token');
    assertEqual(client.sanitizeBibcode('2024A&A...100..123A'), '2024A&A...100..123A');
  });

  test('returns empty string for non-string input', () => {
    const client = new ADSClient('token');
    assertEqual(client.sanitizeBibcode(null), '');
    assertEqual(client.sanitizeBibcode(undefined), '');
    assertEqual(client.sanitizeBibcode(123), '');
  });

  // getLibraries tests
  console.log('\n--- getLibraries ---');

  test('returns libraries from API', async () => {
    const client = new ADSClient('test-token');
    mockFetch({
      libraries: [
        { id: 'lib1', name: 'My Library', num_documents: 10 },
        { id: 'lib2', name: 'Another Library', num_documents: 5 }
      ]
    });

    const libraries = await client.getLibraries();
    assertEqual(libraries.length, 2);
    assertEqual(libraries[0].name, 'My Library');
  });

  test('returns empty array when no libraries', async () => {
    const client = new ADSClient('test-token');
    mockFetch({});

    const libraries = await client.getLibraries();
    assertDeepEqual(libraries, []);
  });

  test('sends authorization header', async () => {
    const client = new ADSClient('my-secret-token');
    mockFetch({ libraries: [] });

    await client.getLibraries();
    assertTrue(mockFetch.lastRequest.options.headers['Authorization'] === 'Bearer my-secret-token');
  });

  // search tests
  console.log('\n--- search ---');

  test('returns search results', async () => {
    const client = new ADSClient('test-token');
    mockFetch({
      response: {
        docs: [
          { bibcode: '2024ApJ...100..123A', title: ['Test Paper'] }
        ],
        numFound: 1
      }
    });

    const result = await client.search('galaxy formation');
    assertEqual(result.documents.length, 1);
    assertEqual(result.numFound, 1);
  });

  test('passes query parameters', async () => {
    const client = new ADSClient('test-token');
    mockFetch({ response: { docs: [], numFound: 0 } });

    await client.search('test query', 50, 10, 'citation_count desc');

    assertTrue(mockFetch.lastRequest.url.includes('q=test+query'));
    assertTrue(mockFetch.lastRequest.url.includes('rows=50'));
    assertTrue(mockFetch.lastRequest.url.includes('start=10'));
  });

  test('returns empty results for no matches', async () => {
    const client = new ADSClient('test-token');
    mockFetch({ response: { docs: [], numFound: 0 } });

    const result = await client.search('nonexistent query');
    assertEqual(result.documents.length, 0);
    assertEqual(result.numFound, 0);
  });

  // exportBibtex tests
  console.log('\n--- exportBibtex ---');

  test('returns bibtex string', async () => {
    const client = new ADSClient('test-token');
    const expectedBibtex = '@article{Smith2024, author={Smith}}';
    mockFetch({ export: expectedBibtex });

    const bibtex = await client.exportBibtex(['2024ApJ...100..123A']);
    assertEqual(bibtex, expectedBibtex);
  });

  test('sends bibcodes in request body', async () => {
    const client = new ADSClient('test-token');
    mockFetch({ export: '' });

    await client.exportBibtex(['bib1', 'bib2']);

    const body = JSON.parse(mockFetch.lastRequest.options.body);
    assertDeepEqual(body.bibcode, ['bib1', 'bib2']);
  });

  test('includes options in request', async () => {
    const client = new ADSClient('test-token');
    mockFetch({ export: '' });

    await client.exportBibtex(['bib1'], {
      keyFormat: 'author:year',
      maxAuthor: 5,
      journalFormat: 2
    });

    const body = JSON.parse(mockFetch.lastRequest.options.body);
    assertEqual(body.keyformat, 'author:year');
    assertEqual(body.maxauthor, 5);
    assertEqual(body.journalformat, 2);
  });

  // Error handling tests
  console.log('\n--- Error Handling ---');

  test('throws ADSError on HTTP error', async () => {
    const client = new ADSClient('test-token');
    mockFetch({ error: 'Unauthorized' }, { ok: false, status: 401 });

    await assertThrows(
      () => client.getLibraries(),
      'ADSError',
      'Should throw ADSError'
    );
  });

  test('throws ADSError on network error', async () => {
    const client = new ADSClient('test-token');
    mockFetchError('Network failure');

    await assertThrows(
      () => client.getLibraries(),
      'ADSError',
      'Should throw ADSError'
    );
  });

  // Summary
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('\n=== Summary ===');
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      console.log(`Total: ${passed + failed}`);
      resolve(failed === 0);
    }, 100);
  });
}

// Run tests if executed directly
if (typeof window === 'undefined') {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests, ADSClient, ADSError };
