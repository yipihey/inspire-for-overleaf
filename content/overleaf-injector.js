/**
 * Overleaf Content Script
 * Injects the INSPIRE sidebar and citation picker into Overleaf
 */

(function() {
  'use strict';

  // Only run on actual project pages (not the project list)
  // Project URLs look like: /project/64f1234567890abcdef12345
  const projectMatch = window.location.pathname.match(/^\/project\/([a-f0-9]{24})$/i);
  if (!projectMatch) {
    console.log('INSPIRE for Overleaf: Not a project editor page, skipping initialization');
    return;
  }

  // Prevent multiple injections
  if (window.inspireForOverleafInjected) return;
  window.inspireForOverleafInjected = true;

  // State
  let state = {
    papers: [],           // Papers from cached .bib file
    searchResults: [],    // Search results from INSPIRE
    isLoading: false,
    error: null,
    preferences: null,
    sidebarVisible: false,
    bibFileName: null,    // Name of loaded .bib file
    filterQuery: '',      // Current filter query for papers view
  };

  // DOM Elements
  let sidebar = null;
  let toggleButton = null;

  /**
   * Initialize the extension
   */
  async function init() {
    console.log('INSPIRE for Overleaf: Initializing...');

    try {
      // Wait for Overleaf editor to load (with timeout)
      await waitForEditor();

      // Create UI elements
      createToggleButton();
      createSidebar();

      // Load preferences (non-critical, use defaults on failure)
      try {
        state.preferences = await sendMessage({ action: 'getPreferences' });
      } catch (prefError) {
        console.warn('INSPIRE for Overleaf: Could not load preferences, using defaults');
        state.preferences = {
          citeCommand: '\\cite',
          maxAuthors: 10,
        };
      }

      // Load cached papers
      try {
        await loadCachedPapers();
      } catch (e) {
        console.log('INSPIRE for Overleaf: No cached papers');
      }

      // Listen for messages from background
      chrome.runtime.onMessage.addListener(handleMessage);

      console.log('INSPIRE for Overleaf: Ready');
    } catch (error) {
      console.error('INSPIRE for Overleaf: Initialization failed:', error);
      createErrorBanner(error.message);
    }
  }

  /**
   * Create an error banner when initialization fails
   */
  function createErrorBanner(message) {
    const banner = document.createElement('div');
    banner.id = 'inspire-error-banner';
    banner.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #fee;
      border: 1px solid #f00;
      border-radius: 4px;
      padding: 10px 15px;
      z-index: 10000;
      font-family: sans-serif;
      font-size: 13px;
      color: #900;
      max-width: 300px;
    `;
    banner.innerHTML = `
      <strong>INSPIRE for Overleaf Error</strong><br>
      ${escapeHtml(message)}<br>
      <button onclick="this.parentElement.remove()" style="margin-top:5px;cursor:pointer;">Dismiss</button>
    `;
    document.body.appendChild(banner);
  }

  /**
   * Wait for Overleaf editor to be ready (with timeout)
   */
  function waitForEditor(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const editor = document.querySelector('.editor-container, .cm-content, .ace_editor');
        if (editor) {
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Timed out waiting for Overleaf editor to load'));
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  /**
   * Send message to background script
   */
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Handle messages from background script
   */
  function handleMessage(message, sender, sendResponse) {
    if (message.action === 'openCitationPicker') {
      showSidebar();
      focusSearch();
    }
  }

  /**
   * Create the toggle button in Overleaf toolbar
   */
  function createToggleButton() {
    toggleButton = document.createElement('button');
    toggleButton.id = 'inspire-toggle-button';
    toggleButton.className = 'ads-toggle-btn';
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <span>INSPIRE</span>
    `;
    toggleButton.title = 'Toggle INSPIRE Panel (Ctrl+Shift+C)';
    toggleButton.addEventListener('click', toggleSidebar);

    // Find toolbar and insert button
    const insertButton = () => {
      const toolbar = document.querySelector('.toolbar-right, .editor-toolbar');
      if (toolbar) {
        toolbar.insertBefore(toggleButton, toolbar.firstChild);
      } else {
        // Fallback: fixed position
        toggleButton.classList.add('ads-toggle-fixed');
        document.body.appendChild(toggleButton);
      }
    };

    insertButton();
  }

  /**
   * Create the sidebar panel
   */
  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.id = 'inspire-sidebar';
    sidebar.className = 'ads-sidebar';
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'INSPIRE Citation Panel');
    sidebar.innerHTML = `
      <div class="ads-sidebar-header">
        <h2 id="inspire-panel-title">INSPIRE for Overleaf</h2>
        <button class="ads-close-btn" title="Close panel" aria-label="Close panel">&times;</button>
      </div>

      <div class="ads-bib-actions" id="inspire-bib-actions">
        <button id="inspire-select-bib-btn" class="ads-action-btn"
                title="Select a .bib file from your computer">
          <span class="ads-btn-icon">+</span> Select .bib
        </button>
        <button id="inspire-refresh-bib-btn" class="ads-action-btn"
                title="Re-read the .bib file from editor">
          <span class="ads-btn-icon">↻</span> Refresh
        </button>
      </div>

      <div id="inspire-bib-status" class="ads-library-selector" style="display:none">
        <span id="inspire-bib-name">No file loaded</span>
        <span id="inspire-paper-count" class="ads-badge"></span>
      </div>

      <div class="ads-search-container" role="search">
        <label for="inspire-search-input" class="visually-hidden">Search</label>
        <input type="text" id="inspire-search-input" placeholder="Filter papers..."
               aria-label="Filter papers or search INSPIRE" />
        <button id="inspire-search-btn" title="Search" aria-label="Execute search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      </div>

      <div class="ads-tabs" role="tablist" aria-label="Content tabs">
        <button class="ads-tab active" data-tab="papers" role="tab"
                aria-selected="true" aria-controls="inspire-papers-tab" id="tab-papers">My Papers</button>
        <button class="ads-tab" data-tab="search" role="tab"
                aria-selected="false" aria-controls="inspire-search-tab" id="tab-search">Search INSPIRE</button>
      </div>

      <div class="ads-content">
        <div id="inspire-papers-tab" class="ads-tab-content active" role="tabpanel"
             aria-labelledby="tab-papers" tabindex="0">
          <div id="inspire-papers-list" class="ads-list" role="list" aria-label="Papers from .bib file"></div>
        </div>

        <div id="inspire-search-tab" class="ads-tab-content" role="tabpanel"
             aria-labelledby="tab-search" tabindex="0" hidden>
          <div id="inspire-search-results" class="ads-list" role="list" aria-label="Search results"></div>
        </div>
      </div>

      <div id="inspire-status" class="ads-status" role="status" aria-live="polite"></div>
    `;

    document.body.appendChild(sidebar);

    // Create hidden file input for .bib selection
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'inspire-file-input';
    fileInput.accept = '.bib';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileSelect);
    document.body.appendChild(fileInput);

    // Event listeners
    sidebar.querySelector('.ads-close-btn').addEventListener('click', hideSidebar);
    sidebar.querySelector('#inspire-search-input').addEventListener('keypress', handleSearchKeypress);
    sidebar.querySelector('#inspire-search-input').addEventListener('input', handleSearchInput);
    sidebar.querySelector('#inspire-search-btn').addEventListener('click', performSearch);
    sidebar.querySelector('#inspire-select-bib-btn').addEventListener('click', () => {
      document.getElementById('inspire-file-input').click();
    });
    sidebar.querySelector('#inspire-refresh-bib-btn').addEventListener('click', refreshFromEditor);

    // Tab switching with keyboard support
    sidebar.querySelectorAll('.ads-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
      tab.addEventListener('keydown', handleTabKeydown);
    });

    // Global keyboard handler for the sidebar
    sidebar.addEventListener('keydown', handleSidebarKeydown);

    console.log('INSPIRE for Overleaf: Sidebar initialized');
  }

  /**
   * Handle keyboard navigation within tabs
   */
  function handleTabKeydown(event) {
    const tabs = Array.from(sidebar.querySelectorAll('.ads-tab'));
    const currentIndex = tabs.indexOf(event.target);

    let newIndex;
    switch (event.key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    tabs[newIndex].focus();
    switchTab(tabs[newIndex].dataset.tab);
  }

  /**
   * Handle global keyboard shortcuts within sidebar
   */
  function handleSidebarKeydown(event) {
    if (event.key === 'Escape') {
      hideSidebar();
      toggleButton?.focus();
    }
  }

  /**
   * Toggle sidebar visibility
   */
  function toggleSidebar() {
    if (state.sidebarVisible) {
      hideSidebar();
    } else {
      showSidebar();
    }
  }

  /**
   * Show sidebar
   */
  function showSidebar() {
    sidebar.classList.add('visible');
    state.sidebarVisible = true;
  }

  /**
   * Hide sidebar
   */
  function hideSidebar() {
    sidebar.classList.remove('visible');
    state.sidebarVisible = false;
  }

  /**
   * Focus search input
   */
  function focusSearch() {
    const input = sidebar.querySelector('#inspire-search-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  /**
   * Switch tabs
   */
  function switchTab(tabName) {
    // Update tab buttons
    sidebar.querySelectorAll('.ads-tab').forEach(t => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive.toString());
    });

    // Update tab panels
    sidebar.querySelectorAll('.ads-tab-content').forEach(c => {
      const isActive = c.id === `inspire-${tabName}-tab`;
      c.classList.toggle('active', isActive);
      if (isActive) {
        c.removeAttribute('hidden');
      } else {
        c.setAttribute('hidden', '');
      }
    });

    // Update search placeholder based on active tab
    updateSearchPlaceholder();

    // Clear search input and filter when switching tabs
    sidebar.querySelector('#inspire-search-input').value = '';
    state.filterQuery = '';
  }

  /**
   * Update search placeholder based on active tab
   */
  function updateSearchPlaceholder() {
    const input = sidebar.querySelector('#inspire-search-input');
    const isPapersTab = sidebar.querySelector('#tab-papers').classList.contains('active');
    input.placeholder = isPapersTab ? 'Filter papers...' : 'Search INSPIRE...';
  }

  /**
   * Get filtered papers based on current filter query
   */
  function getFilteredPapers() {
    if (!state.filterQuery) {
      return state.papers;
    }

    const query = state.filterQuery;
    return state.papers.filter(paper => {
      const title = (Array.isArray(paper.title) ? paper.title[0] : paper.title || '').toLowerCase();
      const authors = (paper.author || []).join(' ').toLowerCase();
      const year = String(paper.year || '');
      const citeKey = (paper.citeKey || paper.bibcode || '').toLowerCase();
      return title.includes(query) || authors.includes(query) || year.includes(query) || citeKey.includes(query);
    });
  }

  /**
   * Load cached papers from storage
   */
  async function loadCachedPapers() {
    const result = await sendMessage({ action: 'getParsedPapers' });
    state.papers = result.papers || [];

    const bibFile = await sendMessage({ action: 'getBibFile' });
    if (bibFile.fileName) {
      state.bibFileName = bibFile.fileName;
      updateBibStatus();
    }

    renderPapers();
  }

  /**
   * Update the .bib file status display
   */
  function updateBibStatus() {
    const statusDiv = sidebar.querySelector('#inspire-bib-status');
    const nameSpan = sidebar.querySelector('#inspire-bib-name');
    const countSpan = sidebar.querySelector('#inspire-paper-count');

    if (state.bibFileName) {
      statusDiv.style.display = 'flex';
      nameSpan.textContent = state.bibFileName;
      countSpan.textContent = state.papers.length;
    } else {
      statusDiv.style.display = 'none';
    }
  }

  /**
   * Handle file selection
   */
  async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setStatus('Reading file...');

    try {
      const content = await file.text();

      // Send to background for parsing and caching
      const result = await sendMessage({
        action: 'parseBibFile',
        payload: { content, fileName: file.name }
      });

      state.papers = result.papers;
      state.bibFileName = file.name;
      updateBibStatus();
      renderPapers();

      setStatus(`Loaded ${result.count} entries from ${file.name}`);
    } catch (error) {
      setError(`Failed to load file: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear the file input so the same file can be selected again
      event.target.value = '';
    }
  }

  /**
   * Refresh papers from the currently open .bib file in editor
   */
  async function refreshFromEditor() {
    setLoading(true);
    setStatus('Reading from editor...');

    try {
      const content = await readEditorContent();
      if (!content) {
        setError('Could not read editor content. Make sure a .bib file is open.');
        return;
      }

      // Try to detect filename
      const fileName = detectBibFileName() || 'editor.bib';

      // Send to background for parsing and caching
      const result = await sendMessage({
        action: 'parseBibFile',
        payload: { content, fileName }
      });

      state.papers = result.papers;
      state.bibFileName = fileName;
      updateBibStatus();
      renderPapers();

      setStatus(`Loaded ${result.count} entries from editor`);
    } catch (error) {
      setError(`Failed to read editor: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Detect .bib filename from Overleaf UI
   */
  function detectBibFileName() {
    // Check URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('.bib')) {
      const match = hash.match(/([^/]+\.bib)/i);
      if (match) return match[1];
    }

    // Check various selectors for current file name
    const selectors = [
      '.toolbar-left .name',
      '.file-tree-item.selected .name',
      '.entity.selected .name',
      '[class*="file-tree"] [class*="selected"] [class*="name"]',
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text.endsWith('.bib')) {
            return text;
          }
        }
      } catch (e) {
        // Ignore invalid selectors
      }
    }

    return null;
  }

  /**
   * Read the content of the currently open editor
   */
  function readEditorContent() {
    return new Promise(async (resolve) => {
      // Try CodeMirror 6 internal state first
      const cmEditor = document.querySelector('.cm-editor');
      if (cmEditor) {
        const possibleViewKeys = Object.keys(cmEditor).filter(k =>
          k.startsWith('__') || k === 'cmView' || k === 'view'
        );

        for (const key of possibleViewKeys) {
          try {
            const obj = cmEditor[key];
            if (obj && obj.view && obj.view.state && obj.view.state.doc) {
              resolve(obj.view.state.doc.toString());
              return;
            }
            if (obj && obj.state && obj.state.doc) {
              resolve(obj.state.doc.toString());
              return;
            }
          } catch (e) {
            // Continue trying
          }
        }
      }

      // Try scroll collection for CM6
      const cmScroller = document.querySelector('.cm-scroller');
      const cmContent = document.querySelector('.cm-content');
      if (cmScroller && cmContent) {
        const content = await scrollAndCollectCM6Content(cmScroller, cmContent);
        if (content) {
          resolve(content);
          return;
        }
      }

      // Try visible content
      if (cmContent) {
        const lines = cmContent.querySelectorAll('.cm-line');
        if (lines.length > 0) {
          resolve(Array.from(lines).map(line => line.textContent).join('\n'));
          return;
        }
      }

      // Try Ace editor
      const aceContent = document.querySelector('.ace_text-layer');
      if (aceContent) {
        const lines = aceContent.querySelectorAll('.ace_line');
        if (lines.length > 0) {
          resolve(Array.from(lines).map(line => line.textContent).join('\n'));
          return;
        }
      }

      resolve(null);
    });
  }

  /**
   * Scroll through CM6 editor to collect all content
   */
  async function scrollAndCollectCM6Content(scroller, content) {
    const originalScroll = scroller.scrollTop;
    const scrollHeight = scroller.scrollHeight;
    const clientHeight = scroller.clientHeight;

    if (scrollHeight <= clientHeight + 50) {
      const lines = content.querySelectorAll('.cm-line');
      return Array.from(lines).map(line => line.textContent).join('\n');
    }

    const lineMap = new Map();

    function collectVisibleLines() {
      const gutterLines = document.querySelectorAll('.cm-lineNumbers .cm-gutterElement');
      const contentLines = content.querySelectorAll('.cm-line');

      gutterLines.forEach(gutterEl => {
        const lineNum = parseInt(gutterEl.textContent, 10);
        if (isNaN(lineNum)) return;

        const gutterRect = gutterEl.getBoundingClientRect();

        for (const line of contentLines) {
          const lineRect = line.getBoundingClientRect();
          if (Math.abs(lineRect.top - gutterRect.top) < 5) {
            if (!lineMap.has(lineNum)) {
              lineMap.set(lineNum, line.textContent);
            }
            break;
          }
        }
      });
    }

    const scrollStep = clientHeight - 50;
    let currentScroll = 0;

    try {
      while (currentScroll < scrollHeight) {
        scroller.scrollTop = currentScroll;
        await sleep(30);
        collectVisibleLines();
        currentScroll += scrollStep;
      }

      scroller.scrollTop = scrollHeight;
      await sleep(30);
      collectVisibleLines();
    } finally {
      scroller.scrollTop = originalScroll;
    }

    const sortedLines = Array.from(lineMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(entry => entry[1]);

    return sortedLines.join('\n');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Render papers list (filtered if search query active)
   */
  function renderPapers() {
    const container = sidebar.querySelector('#inspire-papers-list');

    if (state.papers.length === 0) {
      container.innerHTML = `
        <div class="ads-empty" role="status">
          No papers loaded.<br><br>
          Click "Select .bib" to load a file, or<br>
          "Refresh" to read from the editor.
        </div>
      `;
      return;
    }

    const papers = getFilteredPapers();

    if (papers.length === 0) {
      container.innerHTML = '<div class="ads-empty" role="status">No matching papers</div>';
      return;
    }

    container.innerHTML = papers.map(paper => renderPaperItem(paper, false)).join('');

    // Add click and keyboard handlers
    attachPaperHandlers(container);
  }

  /**
   * Render search results
   */
  function renderSearchResults() {
    const container = sidebar.querySelector('#inspire-search-results');

    if (state.searchResults.length === 0) {
      container.innerHTML = '<div class="ads-empty" role="status">No results found</div>';
      return;
    }

    container.innerHTML = state.searchResults.map(doc => renderPaperItem(doc, true)).join('');

    // Add handlers
    attachPaperHandlers(container);
  }

  /**
   * Render a single paper item
   * @param {Object} paper - Paper data
   * @param {boolean} isSearchResult - True if from INSPIRE search (show Copy BibTeX)
   */
  function renderPaperItem(paper, isSearchResult) {
    const authors = formatAuthors(paper.author);
    const year = paper.year || '';
    const title = paper.title?.[0] || paper.title || 'Untitled';
    const citeKey = paper.citeKey || paper.bibcode || paper.recid || '';
    const recid = paper.recid || paper.bibcode || '';
    const escapedKey = escapeHtml(citeKey);
    const escapedRecid = escapeHtml(recid);

    // For search results, show Copy BibTeX button
    // For local papers, they already have BibTeX
    const actionButtons = isSearchResult
      ? `
        <button class="ads-doc-bibtex" data-recid="${escapedRecid}"
                title="Copy BibTeX" aria-label="Copy BibTeX for ${escapeHtml(authors)} ${year}">Copy BibTeX</button>
        `
      : '';

    // Link to INSPIRE
    const inspireLink = recid
      ? `<a href="https://inspirehep.net/literature/${escapedRecid}" target="_blank" rel="noopener noreferrer"
           class="ads-doc-link" title="Open in INSPIRE" aria-label="Open in INSPIRE">INSPIRE</a>`
      : '';

    return `
      <div class="ads-doc-item" data-citekey="${escapedKey}" data-recid="${escapedRecid}"
           role="listitem" tabindex="0"
           aria-label="${escapeHtml(authors)} ${year}: ${escapeHtml(title)}. Press Enter to insert citation.">
        <div class="ads-doc-title">${escapeHtml(title)}</div>
        <div class="ads-doc-meta">
          <span class="ads-doc-authors">${escapeHtml(authors)}</span>
          <span class="ads-doc-year">${year}</span>
        </div>
        <div class="ads-doc-actions">
          ${actionButtons}
          ${inspireLink}
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers to paper items
   */
  function attachPaperHandlers(container) {
    container.querySelectorAll('.ads-doc-item').forEach(item => {
      // Click to insert citation
      item.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) return;
        insertCitation(item.dataset.citekey);
      });

      // Keyboard navigation
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          insertCitation(item.dataset.citekey);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = item.nextElementSibling;
          if (next?.classList.contains('ads-doc-item')) next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = item.previousElementSibling;
          if (prev?.classList.contains('ads-doc-item')) prev.focus();
        }
      });
    });

    // Copy BibTeX buttons (for search results)
    container.querySelectorAll('.ads-doc-bibtex').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await copyBibtex(btn.dataset.recid);
      });
    });
  }

  /**
   * Handle search keypress
   */
  function handleSearchKeypress(event) {
    if (event.key === 'Enter') {
      performSearch();
    }
  }

  /**
   * Handle search input - real-time filtering for Papers tab only
   */
  function handleSearchInput() {
    const isPapersTab = sidebar.querySelector('#tab-papers').classList.contains('active');
    if (isPapersTab) {
      performSearch();
    }
  }

  /**
   * Perform search - context-aware based on active tab
   */
  async function performSearch() {
    const input = sidebar.querySelector('#inspire-search-input');
    const query = input.value.trim();
    const isPapersTab = sidebar.querySelector('#tab-papers').classList.contains('active');

    if (isPapersTab) {
      // Client-side filtering of papers
      state.filterQuery = query.toLowerCase();
      renderPapers();
      if (query) {
        const filtered = getFilteredPapers();
        setStatus(`Showing ${filtered.length} of ${state.papers.length} papers`);
      } else {
        setStatus('');
      }
      return;
    }

    // INSPIRE API search (Search INSPIRE tab)
    if (!query) return;

    setLoading(true);

    try {
      const result = await sendMessage({
        action: 'search',
        payload: { query, rows: 20 }
      });

      state.searchResults = result.documents || [];
      renderSearchResults();
      setStatus(`Found ${result.numFound} results`);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Insert citation at cursor
   */
  async function insertCitation(citeKey) {
    const citeCmd = state.preferences?.citeCommand || '\\cite';
    const citation = `${citeCmd}{${citeKey}}`;

    setStatus('Inserting citation...');

    const success = await insertTextAtCursor(citation);
    if (success) {
      setStatus(`Inserted: ${citation}`);
    } else {
      await copyToClipboard(citation);
      setStatus(`Copied to clipboard: ${citation}`);
    }
  }

  /**
   * Insert text at cursor in Overleaf editor
   */
  function insertTextAtCursor(text) {
    const cm6 = document.querySelector('.cm-content');
    if (cm6) {
      return insertViaCM6(text);
    }

    const aceEditor = document.querySelector('.ace_editor');
    if (aceEditor) {
      return insertViaAce(text, aceEditor);
    }

    return false;
  }

  /**
   * Insert text using CodeMirror 6
   */
  function insertViaCM6(text) {
    const callbackId = `inspire_cm6_insert_${Date.now()}`;

    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data && event.data.type === callbackId) {
          window.removeEventListener('message', handler);
          resolve(event.data.success);
        }
      };
      window.addEventListener('message', handler);

      const script = document.createElement('script');
      script.textContent = `
        (function() {
          const text = ${JSON.stringify(text)};
          const callbackId = ${JSON.stringify(callbackId)};

          const cmContent = document.querySelector('.cm-content');
          if (!cmContent) {
            window.postMessage({ type: callbackId, success: false }, '*');
            return;
          }

          let element = cmContent;
          let view = null;

          while (element && !view) {
            if (element.cmView) {
              view = element.cmView.view || element.cmView;
            }
            const cmElement = element.closest('.cm-editor');
            if (cmElement && cmElement.cmView) {
              view = cmElement.cmView.view || cmElement.cmView;
            }
            element = element.parentElement;
          }

          if (!view && window._ide && window._ide.editorManager) {
            const editor = window._ide.editorManager.getCurrentDocumentEditor();
            if (editor && editor.view) {
              view = editor.view;
            }
          }

          if (!view) {
            const editorContainer = document.querySelector('.editor-container');
            if (editorContainer) {
              const cmEditor = editorContainer.querySelector('.cm-editor');
              if (cmEditor) {
                const viewKey = Object.keys(cmEditor).find(k => k.startsWith('__'));
                if (viewKey && cmEditor[viewKey] && cmEditor[viewKey].view) {
                  view = cmEditor[viewKey].view;
                }
              }
            }
          }

          if (view && view.dispatch && view.state) {
            const { from, to } = view.state.selection.main;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length }
            });
            view.focus();
            window.postMessage({ type: callbackId, success: true }, '*');
          } else {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.classList.contains('cm-content') ||
                activeElement.closest('.cm-content'))) {
              document.execCommand('insertText', false, text);
              window.postMessage({ type: callbackId, success: true }, '*');
            } else {
              window.postMessage({ type: callbackId, success: false }, '*');
            }
          }
        })();
      `;
      document.documentElement.appendChild(script);
      script.remove();

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, 1000);
    });
  }

  /**
   * Insert text using Ace editor
   */
  function insertViaAce(text, aceElement) {
    const callbackId = `inspire_ace_insert_${Date.now()}`;

    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data && event.data.type === callbackId) {
          window.removeEventListener('message', handler);
          resolve(event.data.success);
        }
      };
      window.addEventListener('message', handler);

      const script = document.createElement('script');
      script.textContent = `
        (function() {
          const text = ${JSON.stringify(text)};
          const callbackId = ${JSON.stringify(callbackId)};

          const aceElement = document.querySelector('.ace_editor');
          if (aceElement && window.ace) {
            try {
              const editor = ace.edit(aceElement);
              editor.insert(text);
              editor.focus();
              window.postMessage({ type: callbackId, success: true }, '*');
            } catch (e) {
              window.postMessage({ type: callbackId, success: false }, '*');
            }
          } else {
            window.postMessage({ type: callbackId, success: false }, '*');
          }
        })();
      `;
      document.documentElement.appendChild(script);
      script.remove();

      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, 1000);
    });
  }

  /**
   * Copy BibTeX to clipboard (for search results)
   */
  async function copyBibtex(recid) {
    try {
      setStatus('Fetching BibTeX...');

      const result = await sendMessage({
        action: 'exportBibtex',
        payload: { recids: [recid] }
      });

      await copyToClipboard(result.bibtex);
      setStatus('BibTeX copied to clipboard');
    } catch (error) {
      setError(error.message);
    }
  }

  /**
   * Copy text to clipboard
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  }

  /**
   * Format authors for display
   */
  function formatAuthors(authors, max = 2) {
    if (!authors || authors.length === 0) return 'Unknown';

    const formatted = authors.slice(0, max).map(a => {
      const parts = a.split(',');
      return parts[0].trim();
    });

    if (authors.length > max) {
      formatted.push('et al.');
    }

    return formatted.join(', ');
  }

  /**
   * Set loading state
   */
  function setLoading(loading) {
    state.isLoading = loading;
    sidebar.classList.toggle('loading', loading);
  }

  /**
   * Set status message
   */
  function setStatus(message) {
    const status = sidebar.querySelector('#inspire-status');
    status.textContent = message;
    status.className = 'ads-status';

    setTimeout(() => {
      status.textContent = '';
    }, 3000);
  }

  /**
   * Set error message
   */
  function setError(message) {
    const status = sidebar.querySelector('#inspire-status');
    status.textContent = message;
    status.className = 'ads-status error';
  }

  /**
   * Escape HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
