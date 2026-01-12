/**
 * Overleaf Content Script
 * Injects the ADS sidebar and citation picker into Overleaf
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.adsForOverleafInjected) return;
  window.adsForOverleafInjected = true;

  // State
  let state = {
    libraries: [],
    currentLibrary: null,
    documents: [],
    searchResults: [],
    isLoading: false,
    error: null,
    preferences: null,
    sidebarVisible: false
  };

  // DOM Elements
  let sidebar = null;
  let toggleButton = null;

  /**
   * Initialize the extension
   */
  async function init() {
    console.log('ADS for Overleaf: Initializing...');

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
        console.warn('ADS for Overleaf: Could not load preferences, using defaults');
        state.preferences = {
          defaultLibrary: null,
          bibtexKeyFormat: null,
          citeCommand: '\\cite',
          maxAuthors: 10,
          journalFormat: 1
        };
      }

      // Load libraries (non-critical, can be done later)
      try {
        await loadLibraries();
      } catch (libError) {
        console.warn('ADS for Overleaf: Could not load libraries:', libError.message);
        setError('Could not load libraries. Check your API token in settings.');
      }

      // Listen for messages from background
      chrome.runtime.onMessage.addListener(handleMessage);

      console.log('ADS for Overleaf: Ready');
    } catch (error) {
      console.error('ADS for Overleaf: Initialization failed:', error);
      // Create minimal UI to show error state
      createErrorBanner(error.message);
    }
  }

  /**
   * Create an error banner when initialization fails
   */
  function createErrorBanner(message) {
    const banner = document.createElement('div');
    banner.id = 'ads-error-banner';
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
      <strong>ADS for Overleaf Error</strong><br>
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
    toggleButton.id = 'ads-toggle-button';
    toggleButton.className = 'ads-toggle-btn';
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <span>ADS</span>
    `;
    toggleButton.title = 'Toggle ADS Panel (Ctrl+Shift+C)';
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
    sidebar.id = 'ads-sidebar';
    sidebar.className = 'ads-sidebar';
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'NASA ADS Citation Panel');
    sidebar.innerHTML = `
      <div class="ads-sidebar-header">
        <h2 id="ads-panel-title">ADS Libraries</h2>
        <button class="ads-close-btn" title="Close panel" aria-label="Close ADS panel">&times;</button>
      </div>

      <div class="ads-search-container" role="search">
        <label for="ads-search-input" class="visually-hidden">Search NASA ADS</label>
        <input type="text" id="ads-search-input" placeholder="Search ADS or your libraries..."
               aria-label="Search NASA ADS or your libraries" />
        <button id="ads-search-btn" title="Search" aria-label="Execute search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      </div>

      <div class="ads-tabs" role="tablist" aria-label="Content tabs">
        <button class="ads-tab active" data-tab="libraries" role="tab"
                aria-selected="true" aria-controls="ads-libraries-tab" id="tab-libraries">Libraries</button>
        <button class="ads-tab" data-tab="search" role="tab"
                aria-selected="false" aria-controls="ads-search-tab" id="tab-search">Search ADS</button>
      </div>

      <div class="ads-content">
        <div id="ads-libraries-tab" class="ads-tab-content active" role="tabpanel"
             aria-labelledby="tab-libraries" tabindex="0">
          <div class="ads-library-selector">
            <label for="ads-library-select" class="visually-hidden">Select a library</label>
            <select id="ads-library-select" aria-label="Select a library">
              <option value="">Select a library...</option>
            </select>
            <button id="ads-refresh-btn" title="Refresh libraries" aria-label="Refresh library list">↻</button>
          </div>
          <div id="ads-documents-list" class="ads-list" role="list" aria-label="Documents in library"></div>
        </div>

        <div id="ads-search-tab" class="ads-tab-content" role="tabpanel"
             aria-labelledby="tab-search" tabindex="0" hidden>
          <div id="ads-search-results" class="ads-list" role="list" aria-label="Search results"></div>
        </div>
      </div>

      <div id="ads-status" class="ads-status" role="status" aria-live="polite"></div>
    `;

    document.body.appendChild(sidebar);

    // Event listeners
    sidebar.querySelector('.ads-close-btn').addEventListener('click', hideSidebar);
    sidebar.querySelector('#ads-search-input').addEventListener('keypress', handleSearchKeypress);
    sidebar.querySelector('#ads-search-btn').addEventListener('click', performSearch);
    sidebar.querySelector('#ads-library-select').addEventListener('change', handleLibraryChange);
    sidebar.querySelector('#ads-refresh-btn').addEventListener('click', () => loadLibraries(true));

    // Tab switching with keyboard support
    sidebar.querySelectorAll('.ads-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
      tab.addEventListener('keydown', handleTabKeydown);
    });

    // Global keyboard handler for the sidebar
    sidebar.addEventListener('keydown', handleSidebarKeydown);
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
    // Escape closes the sidebar
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
    const input = sidebar.querySelector('#ads-search-input');
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
      const isActive = c.id === `ads-${tabName}-tab`;
      c.classList.toggle('active', isActive);
      if (isActive) {
        c.removeAttribute('hidden');
      } else {
        c.setAttribute('hidden', '');
      }
    });
  }

  /**
   * Load user's libraries
   */
  async function loadLibraries(forceRefresh = false) {
    setLoading(true);
    try {
      const result = await sendMessage({ 
        action: 'getLibraries', 
        payload: { forceRefresh } 
      });
      
      state.libraries = result.libraries || [];
      renderLibrarySelector();
      
      if (result.fromCache) {
        setStatus('Loaded from cache');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Render library selector dropdown
   */
  function renderLibrarySelector() {
    const select = sidebar.querySelector('#ads-library-select');
    select.innerHTML = '<option value="">Select a library...</option>';
    
    state.libraries.forEach(lib => {
      const option = document.createElement('option');
      option.value = lib.id;
      option.textContent = `${lib.name} (${lib.num_documents})`;
      select.appendChild(option);
    });
  }

  /**
   * Handle library selection change
   */
  async function handleLibraryChange(event) {
    const libraryId = event.target.value;
    if (!libraryId) {
      state.currentLibrary = null;
      state.documents = [];
      renderDocuments();
      return;
    }

    state.currentLibrary = libraryId;
    await loadDocuments(libraryId);
  }

  /**
   * Load documents from a library
   */
  async function loadDocuments(libraryId, forceRefresh = false) {
    setLoading(true);
    try {
      const result = await sendMessage({
        action: 'getLibraryDocuments',
        payload: { libraryId, forceRefresh }
      });
      
      state.documents = result.documents || [];
      renderDocuments();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Render documents list
   */
  function renderDocuments() {
    const container = sidebar.querySelector('#ads-documents-list');

    if (state.documents.length === 0) {
      container.innerHTML = '<div class="ads-empty" role="status">No documents in this library</div>';
      return;
    }

    container.innerHTML = state.documents.map(doc => renderDocumentItem(doc)).join('');

    // Add click and keyboard handlers
    attachDocumentHandlers(container);
  }

  /**
   * Attach event handlers to document items
   */
  function attachDocumentHandlers(container) {
    container.querySelectorAll('.ads-doc-item').forEach(item => {
      // Click to insert
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons/links
        if (e.target.closest('button, a')) return;
        insertCitation(item.dataset.bibcode);
      });

      // Keyboard: Enter to insert, arrow keys to navigate
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          insertCitation(item.dataset.bibcode);
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

    container.querySelectorAll('.ads-doc-bibtex').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyBibtex(btn.dataset.bibcode);
      });
    });
  }

  /**
   * Render a single document item
   */
  function renderDocumentItem(doc) {
    const authors = formatAuthors(doc.author);
    const year = doc.year || '';
    const title = doc.title?.[0] || 'Untitled';
    const escapedBibcode = escapeHtml(doc.bibcode);

    return `
      <div class="ads-doc-item" data-bibcode="${escapedBibcode}"
           role="listitem" tabindex="0"
           aria-label="${escapeHtml(authors)} ${year}: ${escapeHtml(title)}. Press Enter to insert citation.">
        <div class="ads-doc-title">${escapeHtml(title)}</div>
        <div class="ads-doc-meta">
          <span class="ads-doc-authors">${escapeHtml(authors)}</span>
          <span class="ads-doc-year">${year}</span>
        </div>
        <div class="ads-doc-actions">
          <button class="ads-doc-bibtex" data-bibcode="${escapedBibcode}"
                  title="Copy BibTeX" aria-label="Copy BibTeX for ${escapeHtml(authors)} ${year}">BibTeX</button>
          <a href="https://ui.adsabs.harvard.edu/abs/${escapedBibcode}" target="_blank" rel="noopener noreferrer"
             class="ads-doc-link" title="Open in ADS" aria-label="Open ${escapeHtml(authors)} ${year} in NASA ADS">ADS</a>
        </div>
      </div>
    `;
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
   * Perform ADS search
   */
  async function performSearch() {
    const input = sidebar.querySelector('#ads-search-input');
    const query = input.value.trim();
    
    if (!query) return;

    switchTab('search');
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
   * Render search results
   */
  function renderSearchResults() {
    const container = sidebar.querySelector('#ads-search-results');

    if (state.searchResults.length === 0) {
      container.innerHTML = '<div class="ads-empty" role="status">No results found</div>';
      return;
    }

    container.innerHTML = state.searchResults.map(doc => renderDocumentItem(doc)).join('');

    // Add click and keyboard handlers (reuse same function)
    attachDocumentHandlers(container);
  }

  /**
   * Insert citation at cursor
   */
  async function insertCitation(bibcode) {
    const citeCmd = state.preferences?.citeCommand || '\\cite';
    const citation = `${citeCmd}{${bibcode}}`;

    setStatus('Inserting citation...');

    // Try to insert into editor
    const success = await insertTextAtCursor(citation);
    if (success) {
      setStatus(`Inserted: ${citation}`);
    } else {
      // Fallback: copy to clipboard
      await copyToClipboard(citation);
      setStatus(`Copied to clipboard: ${citation}`);
    }
  }

  /**
   * Insert text at cursor in Overleaf editor
   * Uses injected script to access CodeMirror 6 view instance
   */
  function insertTextAtCursor(text) {
    // Try CodeMirror 6 (new Overleaf editor) via injected script
    const cm6 = document.querySelector('.cm-content');
    if (cm6) {
      return insertViaCM6(text);
    }

    // Try Ace editor (legacy) via injected script
    const aceEditor = document.querySelector('.ace_editor');
    if (aceEditor) {
      return insertViaAce(text, aceEditor);
    }

    return false;
  }

  /**
   * Insert text using CodeMirror 6 by injecting a script into the page context
   */
  function insertViaCM6(text) {
    // Create a unique callback ID for this insertion
    const callbackId = `ads_cm6_insert_${Date.now()}`;

    // Create a promise to wait for the result
    return new Promise((resolve) => {
      // Listen for the result
      const handler = (event) => {
        if (event.data && event.data.type === callbackId) {
          window.removeEventListener('message', handler);
          resolve(event.data.success);
        }
      };
      window.addEventListener('message', handler);

      // Inject script to access CodeMirror 6 view
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          const text = ${JSON.stringify(text)};
          const callbackId = ${JSON.stringify(callbackId)};

          // Find the CodeMirror 6 view instance
          // Overleaf stores it on the DOM element
          const cmContent = document.querySelector('.cm-content');
          if (!cmContent) {
            window.postMessage({ type: callbackId, success: false }, '*');
            return;
          }

          // Walk up to find the element with the view
          let element = cmContent;
          let view = null;

          while (element && !view) {
            // CodeMirror 6 stores view reference in various ways
            if (element.cmView) {
              view = element.cmView.view || element.cmView;
            }
            // Try the EditorView approach
            const cmElement = element.closest('.cm-editor');
            if (cmElement && cmElement.cmView) {
              view = cmElement.cmView.view || cmElement.cmView;
            }
            element = element.parentElement;
          }

          // Alternative: look for Overleaf's editor instance
          if (!view && window._ide && window._ide.editorManager) {
            const editor = window._ide.editorManager.getCurrentDocumentEditor();
            if (editor && editor.view) {
              view = editor.view;
            }
          }

          // Another alternative: query the editor-container
          if (!view) {
            const editorContainer = document.querySelector('.editor-container');
            if (editorContainer) {
              // Search for view in the scope chain
              const cmEditor = editorContainer.querySelector('.cm-editor');
              if (cmEditor) {
                // Access via closure if available
                const viewKey = Object.keys(cmEditor).find(k => k.startsWith('__'));
                if (viewKey && cmEditor[viewKey] && cmEditor[viewKey].view) {
                  view = cmEditor[viewKey].view;
                }
              }
            }
          }

          if (view && view.dispatch && view.state) {
            // Insert at current selection
            const { from, to } = view.state.selection.main;
            view.dispatch({
              changes: { from, to, insert: text },
              selection: { anchor: from + text.length }
            });
            view.focus();
            window.postMessage({ type: callbackId, success: true }, '*');
          } else {
            // Fallback: try using keyboard simulation
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.classList.contains('cm-content') ||
                activeElement.closest('.cm-content'))) {
              // Try execCommand as last resort
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

      // Timeout fallback
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, 1000);
    });
  }

  /**
   * Insert text using Ace editor by injecting a script into the page context
   */
  function insertViaAce(text, aceElement) {
    const callbackId = `ads_ace_insert_${Date.now()}`;

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

          // Find ace editor
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
   * Copy BibTeX to clipboard
   */
  async function copyBibtex(bibcode) {
    try {
      const result = await sendMessage({
        action: 'exportBibtex',
        payload: { 
          bibcodes: [bibcode],
          options: state.preferences || {}
        }
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
      // Fallback for older browsers
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
    const status = sidebar.querySelector('#ads-status');
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
    const status = sidebar.querySelector('#ads-status');
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
