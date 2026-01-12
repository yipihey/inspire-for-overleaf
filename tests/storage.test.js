/**
 * Unit Tests for Storage Module
 */

// Mock storage implementation
const mockStorage = new Map();

const mockChrome = {
  storage: {
    local: {
      get: (keys, callback) => {
        const result = {};
        if (keys === null) {
          mockStorage.forEach((value, key) => {
            result[key] = value;
          });
        } else {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(key => {
            if (mockStorage.has(key)) {
              result[key] = mockStorage.get(key);
            }
          });
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      },
      set: (items, callback) => {
        Object.entries(items).forEach(([key, value]) => {
          mockStorage.set(key, value);
        });
        if (callback) callback();
        return Promise.resolve();
      },
      remove: (keys, callback) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(key => mockStorage.delete(key));
        if (callback) callback();
        return Promise.resolve();
      },
      clear: (callback) => {
        mockStorage.clear();
        if (callback) callback();
        return Promise.resolve();
      }
    }
  },
  runtime: {
    lastError: null
  }
};

// Set up global mocks
globalThis.chrome = mockChrome;
globalThis.browser = undefined;

// Storage implementation (simplified for testing)
const CACHE_CONFIG = {
  defaultTTL: 5 * 60 * 1000,
  libraryTTL: 5 * 60 * 1000,
  documentsTTL: 5 * 60 * 1000
};

const Storage = {
  async get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  },

  async set(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  async remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  async getToken() {
    const result = await this.get(['adsToken']);
    return result.adsToken || null;
  },

  async setToken(token) {
    await this.set({ adsToken: token });
  },

  async getPreferences() {
    const result = await this.get(['preferences']);
    return result.preferences || {
      defaultLibrary: null,
      bibtexKeyFormat: null,
      citeCommand: '\\cite',
      maxAuthors: 10,
      journalFormat: 1
    };
  },

  async setPreferences(prefs) {
    const current = await this.getPreferences();
    await this.set({ preferences: { ...current, ...prefs } });
  },

  async getCachedLibraries() {
    const result = await this.get(['librariesCache', 'librariesCacheTime']);
    const cacheAge = Date.now() - (result.librariesCacheTime || 0);

    if (cacheAge < CACHE_CONFIG.libraryTTL && result.librariesCache) {
      return result.librariesCache;
    }
    return null;
  },

  async setCachedLibraries(libraries) {
    await this.set({
      librariesCache: libraries,
      librariesCacheTime: Date.now()
    });
  }
};

// Helper to clear storage between tests
function clearStorage() {
  mockStorage.clear();
  chrome.runtime.lastError = null;
}

// Test Runner
async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    clearStorage();
    try {
      await fn();
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

  function assertNull(value, message = '') {
    if (value !== null) {
      throw new Error(message || `Expected null but got ${JSON.stringify(value)}`);
    }
  }

  console.log('\n=== Storage Tests ===\n');

  // Basic get/set tests
  console.log('--- Basic Operations ---');

  await test('set and get single value', async () => {
    await Storage.set({ testKey: 'testValue' });
    const result = await Storage.get(['testKey']);
    assertEqual(result.testKey, 'testValue');
  });

  await test('get returns empty object for missing keys', async () => {
    const result = await Storage.get(['nonexistent']);
    assertDeepEqual(result, {});
  });

  await test('set multiple values', async () => {
    await Storage.set({ key1: 'value1', key2: 'value2' });
    const result = await Storage.get(['key1', 'key2']);
    assertEqual(result.key1, 'value1');
    assertEqual(result.key2, 'value2');
  });

  await test('remove values', async () => {
    await Storage.set({ key1: 'value1', key2: 'value2' });
    await Storage.remove(['key1']);
    const result = await Storage.get(['key1', 'key2']);
    assertEqual(result.key1, undefined);
    assertEqual(result.key2, 'value2');
  });

  // Token tests
  console.log('\n--- Token Management ---');

  await test('getToken returns null when not set', async () => {
    const token = await Storage.getToken();
    assertNull(token);
  });

  await test('setToken and getToken', async () => {
    await Storage.setToken('my-api-token');
    const token = await Storage.getToken();
    assertEqual(token, 'my-api-token');
  });

  await test('setToken overwrites existing token', async () => {
    await Storage.setToken('token1');
    await Storage.setToken('token2');
    const token = await Storage.getToken();
    assertEqual(token, 'token2');
  });

  // Preferences tests
  console.log('\n--- Preferences ---');

  await test('getPreferences returns defaults when not set', async () => {
    const prefs = await Storage.getPreferences();
    assertEqual(prefs.citeCommand, '\\cite');
    assertEqual(prefs.maxAuthors, 10);
    assertNull(prefs.defaultLibrary);
  });

  await test('setPreferences merges with existing', async () => {
    await Storage.setPreferences({ citeCommand: '\\citep' });
    await Storage.setPreferences({ maxAuthors: 5 });

    const prefs = await Storage.getPreferences();
    assertEqual(prefs.citeCommand, '\\citep');
    assertEqual(prefs.maxAuthors, 5);
  });

  await test('setPreferences preserves defaults', async () => {
    await Storage.setPreferences({ citeCommand: '\\citet' });

    const prefs = await Storage.getPreferences();
    assertEqual(prefs.journalFormat, 1); // Default preserved
    assertEqual(prefs.citeCommand, '\\citet'); // Updated
  });

  // Cache tests
  console.log('\n--- Caching ---');

  await test('getCachedLibraries returns null when not cached', async () => {
    const cached = await Storage.getCachedLibraries();
    assertNull(cached);
  });

  await test('setCachedLibraries and getCachedLibraries', async () => {
    const libraries = [{ id: 'lib1', name: 'Test Library' }];
    await Storage.setCachedLibraries(libraries);

    const cached = await Storage.getCachedLibraries();
    assertDeepEqual(cached, libraries);
  });

  await test('cached libraries expire after TTL', async () => {
    const libraries = [{ id: 'lib1', name: 'Test Library' }];
    await Storage.setCachedLibraries(libraries);

    // Manually set cache time to past
    const expiredTime = Date.now() - CACHE_CONFIG.libraryTTL - 1000;
    mockStorage.set('librariesCacheTime', expiredTime);

    const cached = await Storage.getCachedLibraries();
    assertNull(cached);
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
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests, Storage };
