/**
 * Popup script
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Check if token is configured
  const result = await chrome.storage.local.get(['adsToken']);
  
  if (result.adsToken) {
    showConfigured();
    loadLibraries();
  } else {
    showNotConfigured();
  }

  // Event listeners
  document.getElementById('open-options').addEventListener('click', openOptions);
  document.getElementById('settings-link').addEventListener('click', openOptions);
  document.getElementById('refresh-btn').addEventListener('click', () => loadLibraries(true));
  document.getElementById('open-overleaf').addEventListener('click', openOverleafPanel);

  // Check if we're on Overleaf
  checkOverleafTab();
}

function showNotConfigured() {
  document.getElementById('not-configured').classList.remove('hidden');
  document.getElementById('configured').classList.add('hidden');
}

function showConfigured() {
  document.getElementById('not-configured').classList.add('hidden');
  document.getElementById('configured').classList.remove('hidden');
}

function openOptions(e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
}

async function loadLibraries(forceRefresh = false) {
  const listEl = document.getElementById('libraries-list');
  listEl.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getLibraries',
      payload: { forceRefresh }
    });

    if (response.error) {
      throw new Error(response.error);
    }

    renderLibraries(response.libraries || []);
  } catch (error) {
    listEl.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

function renderLibraries(libraries) {
  const listEl = document.getElementById('libraries-list');

  if (libraries.length === 0) {
    listEl.innerHTML = '<div class="loading">No libraries found</div>';
    return;
  }

  listEl.innerHTML = libraries.map(lib => `
    <div class="library-item">
      <span class="library-name">${escapeHtml(lib.name)}</span>
      <span class="library-count">${lib.num_documents}</span>
    </div>
  `).join('');
}

async function checkOverleafTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  const isOverleaf = currentTab?.url?.includes('overleaf.com/project/');
  const openBtn = document.getElementById('open-overleaf');
  
  if (isOverleaf) {
    openBtn.disabled = false;
    openBtn.textContent = 'Open ADS Panel';
  } else {
    openBtn.disabled = true;
    openBtn.textContent = 'Open Overleaf to use panel';
  }
}

async function openOverleafPanel() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (currentTab?.url?.includes('overleaf.com')) {
    await chrome.tabs.sendMessage(currentTab.id, { action: 'openCitationPicker' });
    window.close();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
