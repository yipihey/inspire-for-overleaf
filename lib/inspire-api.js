/**
 * INSPIRE HEP API Client
 * Handles all communication with the INSPIRE HEP API
 *
 * API Documentation: https://github.com/inspirehep/rest-api-doc
 */

const INSPIRE_API_BASE = 'https://inspirehep.net/api';

// Rate limiting configuration
// INSPIRE allows ~15 requests per 5-second window
const RATE_LIMIT = {
  maxRequests: 12,      // Stay under limit
  windowMs: 5000,       // 5 second window
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

class INSPIREClient {
  constructor() {
    // No authentication needed for INSPIRE
  }

  /**
   * Make a request to the INSPIRE API with rate limiting and retry
   */
  async request(endpoint, options = {}, retryCount = 0) {
    // Apply rate limiting
    await rateLimiter.throttle();

    const url = `${INSPIRE_API_BASE}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
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
        // Handle rate limiting (429)
        if (response.status === 429 && retryCount < RATE_LIMIT.maxRetries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10) * 1000;
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          return this.request(endpoint, options, retryCount + 1);
        }

        throw new INSPIREError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      // Check content type - might be BibTeX
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/x-bibtex') || contentType.includes('text/plain')) {
        return await response.text();
      }

      return await response.json();
    } catch (error) {
      if (error instanceof INSPIREError) throw error;

      if (error.name === 'AbortError') {
        throw new INSPIREError('Request timed out. Please try again.', 0);
      }

      // Retry on network errors
      if (retryCount < RATE_LIMIT.maxRetries && error.name !== 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryAfterMs));
        return this.request(endpoint, options, retryCount + 1);
      }

      throw new INSPIREError(`Network error: ${error.message}`, 0);
    }
  }

  /**
   * Search INSPIRE literature
   * @param {string} query - Search query (INSPIRE query syntax)
   * @param {number} size - Number of results (default 20, max 1000)
   * @param {number} page - Page number (1-indexed)
   * @param {string} sort - Sort order ('mostrecent', 'mostcited')
   * @returns {Promise<{documents: Array, numFound: number}>}
   */
  async search(query, size = 20, page = 1, sort = 'mostrecent') {
    const params = new URLSearchParams({
      q: query,
      size: size.toString(),
      page: page.toString(),
      sort: sort,
      fields: 'control_number,titles,authors,publication_info,dois,arxiv_eprints,abstracts,citation_count,earliest_date'
    });

    const data = await this.request(`/literature?${params}`);

    return {
      documents: (data.hits?.hits || []).map(hit => this.normalizeDocument(hit)),
      numFound: data.hits?.total || 0
    };
  }

  /**
   * Get BibTeX for a single record by recid
   * @param {string|number} recid - INSPIRE record ID
   * @returns {Promise<string>} BibTeX string
   */
  async getBibtex(recid) {
    const bibtex = await this.request(`/literature/${recid}?format=bibtex`, {
      headers: { 'Accept': 'application/x-bibtex' }
    });
    return bibtex;
  }

  /**
   * Get BibTeX for multiple records
   * @param {Array<string|number>} recids - Array of INSPIRE record IDs
   * @returns {Promise<string>} Combined BibTeX string
   */
  async exportBibtex(recids) {
    if (!recids || recids.length === 0) {
      return '';
    }

    // INSPIRE supports batch BibTeX export via search with recids
    const query = `recid:${recids.join(' OR recid:')}`;
    const params = new URLSearchParams({
      q: query,
      size: recids.length.toString(),
      format: 'bibtex'
    });

    const bibtex = await this.request(`/literature?${params}`, {
      headers: { 'Accept': 'application/x-bibtex' }
    });

    return bibtex;
  }

  /**
   * Lookup a record by DOI
   * @param {string} doi - DOI (e.g., "10.1103/PhysRevLett.116.061102")
   * @returns {Promise<Object|null>} Normalized document or null if not found
   */
  async lookupByDOI(doi) {
    try {
      const data = await this.request(`/doi/${encodeURIComponent(doi)}`);
      if (data.metadata) {
        return this.normalizeDocument({ metadata: data.metadata });
      }
      return null;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Lookup a record by arXiv ID
   * @param {string} arxivId - arXiv ID (e.g., "2310.12345" or "hep-th/9901001")
   * @returns {Promise<Object|null>} Normalized document or null if not found
   */
  async lookupByArxiv(arxivId) {
    try {
      // Clean arXiv ID - remove "arXiv:" prefix if present
      const cleanId = arxivId.replace(/^arXiv:/i, '').replace(/v\d+$/, '');
      const data = await this.request(`/arxiv/${encodeURIComponent(cleanId)}`);
      if (data.metadata) {
        return this.normalizeDocument({ metadata: data.metadata });
      }
      return null;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Get a single record by recid
   * @param {string|number} recid - INSPIRE record ID
   * @returns {Promise<Object>} Normalized document
   */
  async getRecord(recid) {
    const data = await this.request(`/literature/${recid}`);
    return this.normalizeDocument(data);
  }

  /**
   * Normalize INSPIRE document format to internal format
   * @param {Object} hit - Raw INSPIRE API response hit
   * @returns {Object} Normalized document
   */
  normalizeDocument(hit) {
    const meta = hit.metadata || hit;

    // Extract primary title
    const title = meta.titles?.[0]?.title || 'Untitled';

    // Extract authors
    const authors = (meta.authors || []).map(a => {
      const name = a.full_name || '';
      // Convert to "Last, First" format if not already
      if (name.includes(',')) {
        return name;
      }
      const parts = name.split(' ');
      if (parts.length > 1) {
        const last = parts.pop();
        return `${last}, ${parts.join(' ')}`;
      }
      return name;
    });

    // Extract year from earliest_date or publication_info
    let year = null;
    if (meta.earliest_date) {
      year = parseInt(meta.earliest_date.substring(0, 4), 10);
    } else if (meta.publication_info?.[0]?.year) {
      year = meta.publication_info[0].year;
    }

    // Extract DOI
    const doi = meta.dois?.[0]?.value || null;

    // Extract arXiv ID
    const arxivEprint = meta.arxiv_eprints?.[0];
    const arxivId = arxivEprint?.value || null;

    // Extract journal/venue
    const pubInfo = meta.publication_info?.[0];
    const venue = pubInfo?.journal_title || pubInfo?.pubinfo_freetext || null;

    // Extract abstract
    const abstract = meta.abstracts?.[0]?.value || null;

    // INSPIRE record ID (control_number)
    const recid = String(meta.control_number || meta.id || '');

    return {
      // Use recid as the primary identifier (equivalent to bibcode in ADS)
      bibcode: recid,
      recid: recid,
      title: [title],
      author: authors,
      year: year,
      pub: venue,
      abstract: abstract,
      doi: doi ? [doi] : undefined,
      arxivId: arxivId,
      identifier: this.buildIdentifiers(recid, doi, arxivId),
      citation_count: meta.citation_count || 0,
      // Keep original metadata for reference
      _inspire: meta
    };
  }

  /**
   * Build identifier array
   */
  buildIdentifiers(recid, doi, arxivId) {
    const identifiers = [];
    if (recid) identifiers.push(`inspire:${recid}`);
    if (doi) identifiers.push(`doi:${doi}`);
    if (arxivId) identifiers.push(`arXiv:${arxivId}`);
    return identifiers;
  }

  /**
   * Convert a normalized document to a citable key
   * Uses INSPIRE's preferred key format: AuthorYear
   */
  generateCiteKey(doc) {
    const firstAuthor = doc.author?.[0] || 'Unknown';
    const lastName = firstAuthor.split(',')[0].replace(/[^a-zA-Z]/g, '');
    const year = doc.year || '';
    return `${lastName}:${year}${doc.recid}`;
  }
}

class INSPIREError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'INSPIREError';
    this.status = status;
  }
}

// ES Module exports
export { INSPIREClient, INSPIREError, RATE_LIMIT };
