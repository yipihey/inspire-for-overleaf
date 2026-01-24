/**
 * Storage wrapper for browser extension storage
 * Provides a consistent API across Chrome and Firefox
 */

// Default cache configuration
const CACHE_CONFIG = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes in ms
  bibFileTTL: 24 * 60 * 60 * 1000, // 24 hours for bib file cache
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

  // ============================================================================
  // User Preferences
  // ============================================================================

  /**
   * Get user preferences
   */
  async getPreferences() {
    const result = await this.get(['preferences']);
    return result.preferences || {
      citeCommand: '\\cite',
      maxAuthors: 10,
    };
  },

  /**
   * Set user preferences
   */
  async setPreferences(prefs) {
    const current = await this.getPreferences();
    await this.set({ preferences: { ...current, ...prefs } });
  },

  // ============================================================================
  // Local .bib File Cache
  // ============================================================================

  /**
   * Store cached .bib file content
   * @param {string} content - Raw .bib file content
   * @param {string} fileName - Name of the .bib file for display
   */
  async setBibFileContent(content, fileName) {
    await this.set({
      bibFileContent: content,
      bibFileName: fileName,
      bibFileLastRead: Date.now(),
    });
  },

  /**
   * Get cached .bib file content
   * @returns {Promise<{content: string|null, fileName: string|null, lastRead: number|null}>}
   */
  async getBibFileContent() {
    const result = await this.get(['bibFileContent', 'bibFileName', 'bibFileLastRead']);
    return {
      content: result.bibFileContent || null,
      fileName: result.bibFileName || null,
      lastRead: result.bibFileLastRead || null,
    };
  },

  /**
   * Store parsed papers from .bib file
   * @param {Array} papers - Parsed paper entries
   */
  async setParsedPapers(papers) {
    await this.set({
      parsedPapers: papers,
      parsedPapersTime: Date.now(),
    });
  },

  /**
   * Get parsed papers from cache
   * @returns {Promise<Array|null>}
   */
  async getParsedPapers() {
    const result = await this.get(['parsedPapers', 'parsedPapersTime']);
    return result.parsedPapers || null;
  },

  /**
   * Clear cached .bib file and parsed papers
   */
  async clearBibFile() {
    await this.remove([
      'bibFileContent',
      'bibFileName',
      'bibFileLastRead',
      'parsedPapers',
      'parsedPapersTime',
    ]);
  },

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all caches
   */
  async clearCaches() {
    const all = await this.get(null);
    const cacheKeys = Object.keys(all).filter(k =>
      k.includes('Cache') || k.includes('parsed') || k.includes('bibFile')
    );
    if (cacheKeys.length > 0) {
      await this.remove(cacheKeys);
    }
  },

  /**
   * Update cache configuration
   */
  setCacheTTL(config) {
    if (config.bibFileTTL) CACHE_CONFIG.bibFileTTL = config.bibFileTTL;
    if (config.defaultTTL) CACHE_CONFIG.defaultTTL = config.defaultTTL;
  }
};

// ES Module exports (for service worker with type: module)
export { Storage, CACHE_CONFIG };
