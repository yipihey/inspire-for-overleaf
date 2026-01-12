/**
 * Browser API Polyfill
 * Normalizes Chrome and Firefox extension APIs
 *
 * Firefox uses `browser.*` with native Promise support
 * Chrome uses `chrome.*` with callback-based APIs (though modern Chrome also supports promises)
 *
 * This polyfill creates a unified `browserAPI` object that works in both browsers
 */

const browserAPI = (() => {
  // Check if we're in Firefox (has native browser.* with promises)
  const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id;

  // Use Firefox's native API if available, otherwise wrap Chrome's API
  if (isFirefox) {
    return browser;
  }

  // For Chrome, chrome.* already supports promises in Manifest V3
  // But we wrap it for consistency and to handle any edge cases
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }

  // Fallback for testing environments
  console.warn('No browser extension API detected');
  return null;
})();

/**
 * Promisified storage helper that works in both browsers
 */
const storageHelper = {
  async get(keys) {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.storage?.local;
      if (!api) {
        reject(new Error('Storage API not available'));
        return;
      }

      api.get(keys, (result) => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(result);
        }
      });
    });
  },

  async set(items) {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.storage?.local;
      if (!api) {
        reject(new Error('Storage API not available'));
        return;
      }

      api.set(items, () => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve();
        }
      });
    });
  },

  async remove(keys) {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.storage?.local;
      if (!api) {
        reject(new Error('Storage API not available'));
        return;
      }

      api.remove(keys, () => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve();
        }
      });
    });
  },

  async clear() {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.storage?.local;
      if (!api) {
        reject(new Error('Storage API not available'));
        return;
      }

      api.clear(() => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve();
        }
      });
    });
  }
};

/**
 * Promisified messaging helper
 */
const messagingHelper = {
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.runtime;
      if (!api) {
        reject(new Error('Runtime API not available'));
        return;
      }

      api.sendMessage(message, (response) => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  },

  async sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.tabs;
      if (!api) {
        reject(new Error('Tabs API not available'));
        return;
      }

      api.sendMessage(tabId, message, (response) => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(response);
        }
      });
    });
  }
};

/**
 * Promisified tabs helper
 */
const tabsHelper = {
  async query(queryInfo) {
    return new Promise((resolve, reject) => {
      const api = browserAPI?.tabs;
      if (!api) {
        reject(new Error('Tabs API not available'));
        return;
      }

      api.query(queryInfo, (tabs) => {
        const error = browserAPI.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(tabs);
        }
      });
    });
  }
};

// ES Module exports
export { browserAPI, storageHelper, messagingHelper, tabsHelper };
