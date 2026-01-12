/**
 * Storage wrapper for browser extension storage
 * Provides a consistent API across Chrome and Firefox
 */

// Default cache configuration
const CACHE_CONFIG = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes in ms
  libraryTTL: 5 * 60 * 1000,
  documentsTTL: 5 * 60 * 1000
};

// Browser API detection (Firefox uses `browser`, Chrome uses `chrome`)
const browserStorage = (() => {
  if (typeof browser !== 'undefined' && browser.storage) {
    return browser.storage.local;
  }
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage.local;
  }
  return null;
})();

const browserRuntime = (() => {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser.runtime;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  }
  return null;
})();

const Storage = {
  /**
   * Get items from local storage
   */
  async get(keys) {
    return new Promise((resolve, reject) => {
      if (!browserStorage) {
        reject(new Error('Storage API not available'));
        return;
      }
      browserStorage.get(keys, (result) => {
        if (browserRuntime?.lastError) {
          reject(new Error(browserRuntime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  },

  /**
   * Set items in local storage
   */
  async set(items) {
    return new Promise((resolve, reject) => {
      if (!browserStorage) {
        reject(new Error('Storage API not available'));
        return;
      }
      browserStorage.set(items, () => {
        if (browserRuntime?.lastError) {
          reject(new Error(browserRuntime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Remove items from local storage
   */
  async remove(keys) {
    return new Promise((resolve, reject) => {
      if (!browserStorage) {
        reject(new Error('Storage API not available'));
        return;
      }
      browserStorage.remove(keys, () => {
        if (browserRuntime?.lastError) {
          reject(new Error(browserRuntime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Clear all local storage
   */
  async clear() {
    return new Promise((resolve, reject) => {
      if (!browserStorage) {
        reject(new Error('Storage API not available'));
        return;
      }
      browserStorage.clear(() => {
        if (browserRuntime?.lastError) {
          reject(new Error(browserRuntime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  // Convenience methods for specific data

  /**
   * Get the ADS API token
   */
  async getToken() {
    const result = await this.get(['adsToken']);
    return result.adsToken || null;
  },

  /**
   * Set the ADS API token
   */
  async setToken(token) {
    await this.set({ adsToken: token });
  },

  /**
   * Get user preferences
   */
  async getPreferences() {
    const result = await this.get(['preferences']);
    return result.preferences || {
      defaultLibrary: null,
      bibtexKeyFormat: null,  // null = bibcode
      citeCommand: '\\cite',
      maxAuthors: 10,
      journalFormat: 1
    };
  },

  /**
   * Set user preferences
   */
  async setPreferences(prefs) {
    const current = await this.getPreferences();
    await this.set({ preferences: { ...current, ...prefs } });
  },

  /**
   * Get cached libraries
   */
  async getCachedLibraries() {
    const result = await this.get(['librariesCache', 'librariesCacheTime']);
    const cacheAge = Date.now() - (result.librariesCacheTime || 0);

    if (cacheAge < CACHE_CONFIG.libraryTTL && result.librariesCache) {
      return result.librariesCache;
    }
    return null;
  },

  /**
   * Set cached libraries
   */
  async setCachedLibraries(libraries) {
    await this.set({
      librariesCache: libraries,
      librariesCacheTime: Date.now()
    });
  },

  /**
   * Get cached library documents
   */
  async getCachedLibraryDocs(libraryId) {
    const result = await this.get([`libDocs_${libraryId}`, `libDocsTime_${libraryId}`]);
    const cacheAge = Date.now() - (result[`libDocsTime_${libraryId}`] || 0);

    if (cacheAge < CACHE_CONFIG.documentsTTL && result[`libDocs_${libraryId}`]) {
      return result[`libDocs_${libraryId}`];
    }
    return null;
  },

  /**
   * Set cached library documents
   */
  async setCachedLibraryDocs(libraryId, docs) {
    await this.set({
      [`libDocs_${libraryId}`]: docs,
      [`libDocsTime_${libraryId}`]: Date.now()
    });
  },

  /**
   * Clear all caches
   */
  async clearCaches() {
    const all = await this.get(null);
    const cacheKeys = Object.keys(all).filter(k =>
      k.includes('Cache') || k.includes('libDocs')
    );
    if (cacheKeys.length > 0) {
      await this.remove(cacheKeys);
    }
  },

  /**
   * Update cache configuration
   */
  setCacheTTL(config) {
    if (config.libraryTTL) CACHE_CONFIG.libraryTTL = config.libraryTTL;
    if (config.documentsTTL) CACHE_CONFIG.documentsTTL = config.documentsTTL;
    if (config.defaultTTL) CACHE_CONFIG.defaultTTL = config.defaultTTL;
  }
};

// ES Module exports (for service worker with type: module)
export { Storage, CACHE_CONFIG };
