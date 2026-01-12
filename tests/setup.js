/**
 * Test Setup
 * Mock browser extension APIs for testing
 */

// Mock chrome.storage.local
const mockStorage = new Map();

globalThis.chrome = {
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
    lastError: null,
    sendMessage: () => {},
    onMessage: {
      addListener: () => {}
    }
  }
};

// Mock browser API for Firefox compatibility
globalThis.browser = undefined;

// Mock fetch
globalThis.fetch = async (url, options = {}) => {
  throw new Error('fetch should be mocked in individual tests');
};

// Helper to clear storage between tests
export function clearMockStorage() {
  mockStorage.clear();
  chrome.runtime.lastError = null;
}

// Helper to set mock storage values
export function setMockStorage(data) {
  Object.entries(data).forEach(([key, value]) => {
    mockStorage.set(key, value);
  });
}

// Helper to get all mock storage
export function getMockStorage() {
  const result = {};
  mockStorage.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Mock fetch helper
export function mockFetch(responseData, options = {}) {
  const { status = 200, ok = true, headers = {} } = options;

  globalThis.fetch = async () => ({
    ok,
    status,
    headers: {
      get: (name) => headers[name] || null
    },
    json: async () => responseData
  });
}

// Mock fetch error
export function mockFetchError(errorMessage) {
  globalThis.fetch = async () => {
    throw new Error(errorMessage);
  };
}
