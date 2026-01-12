/**
 * ADS API Client
 * Handles all communication with the NASA ADS API
 */

const ADS_API_BASE = 'https://api.adsabs.harvard.edu/v1';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 10,      // Max requests per window
  windowMs: 1000,       // Window size in ms (1 second)
  retryAfterMs: 1000,   // Wait time when rate limited
  maxRetries: 3         // Max retry attempts
};

// Simple rate limiter
const rateLimiter = {
  requests: [],

  async throttle() {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter(t => now - t < RATE_LIMIT.windowMs);

    if (this.requests.length >= RATE_LIMIT.maxRequests) {
      // Wait until oldest request expires
      const waitTime = RATE_LIMIT.windowMs - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.throttle(); // Re-check after waiting
    }

    this.requests.push(now);
  }
};

class ADSClient {
  constructor(token) {
    this.token = token;
  }

  /**
   * Make an authenticated request to the ADS API with rate limiting and retry
   */
  async request(endpoint, options = {}, retryCount = 0) {
    // Apply rate limiting
    await rateLimiter.throttle();

    const url = `${ADS_API_BASE}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        // Handle rate limiting from ADS (429)
        if (response.status === 429 && retryCount < RATE_LIMIT.maxRetries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          return this.request(endpoint, options, retryCount + 1);
        }

        throw new ADSError(
          error.error || `HTTP ${response.status}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ADSError) throw error;

      // Retry on network errors
      if (error.name === 'AbortError') {
        throw new ADSError('Request timed out. Please try again.', 0);
      }

      if (retryCount < RATE_LIMIT.maxRetries && error.name !== 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryAfterMs));
        return this.request(endpoint, options, retryCount + 1);
      }

      throw new ADSError(`Network error: ${error.message}`, 0);
    }
  }

  /**
   * Validate the API token
   */
  async validateToken() {
    try {
      await this.getLibraries();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get all user libraries
   */
  async getLibraries() {
    const data = await this.request('/biblib/libraries');
    return data.libraries || [];
  }

  /**
   * Get contents of a specific library
   */
  async getLibrary(libraryId) {
    const data = await this.request(`/biblib/libraries/${libraryId}`);
    return data;
  }

  /**
   * Get library documents with full metadata
   */
  async getLibraryDocuments(libraryId, start = 0, rows = 100) {
    // First get the bibcodes
    const library = await this.getLibrary(libraryId);
    const bibcodes = library.documents || [];
    
    if (bibcodes.length === 0) {
      return { documents: [], numFound: 0 };
    }

    // Then fetch full metadata
    const subset = bibcodes.slice(start, start + rows);
    return await this.getDocumentsByBibcode(subset);
  }

  /**
   * Sanitize a bibcode to prevent query injection
   */
  sanitizeBibcode(bibcode) {
    if (typeof bibcode !== 'string') return '';
    // Bibcodes are alphanumeric with dots and ampersands
    // Example: 2024ApJ...100..123A
    return bibcode.replace(/[^a-zA-Z0-9.&]/g, '');
  }

  /**
   * Get documents by bibcode
   */
  async getDocumentsByBibcode(bibcodes) {
    if (!bibcodes || bibcodes.length === 0) {
      return { documents: [], numFound: 0 };
    }

    // Sanitize all bibcodes to prevent query injection
    const sanitized = bibcodes
      .map(b => this.sanitizeBibcode(b))
      .filter(b => b.length > 0);

    if (sanitized.length === 0) {
      return { documents: [], numFound: 0 };
    }

    const query = `bibcode:(${sanitized.map(b => `"${b}"`).join(' OR ')})`;
    return await this.search(query, sanitized.length);
  }

  /**
   * Search ADS
   */
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

  /**
   * Export to BibTeX
   */
  async exportBibtex(bibcodes, options = {}) {
    const {
      keyFormat = null,  // null = use bibcode (default)
      maxAuthor = 10,
      authorCutoff = 200,
      journalFormat = 1  // 1 = AASTeX macros, 2 = journal names, 3 = abbreviated
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

  /**
   * Add papers to a library
   */
  async addToLibrary(libraryId, bibcodes) {
    const data = await this.request(`/biblib/documents/${libraryId}`, {
      method: 'POST',
      body: JSON.stringify({
        bibcode: bibcodes,
        action: 'add'
      })
    });
    return data;
  }
}

class ADSError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ADSError';
    this.status = status;
  }
}

// ES Module exports (for service worker with type: module)
export { ADSClient, ADSError, RATE_LIMIT };
