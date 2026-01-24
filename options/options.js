/**
 * Options page script for INSPIRE for Overleaf
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load saved settings
  await loadSettings();

  // Event listeners
  document.getElementById('clear-bib').addEventListener('click', clearBibCache);
  document.getElementById('clear-cache').addEventListener('click', clearAllCache);

  // Auto-save preferences on change
  document.getElementById('max-authors').addEventListener('change', savePreferences);
  document.getElementById('cite-command').addEventListener('change', savePreferences);
}

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPreferences' });

    if (response.maxAuthors) {
      document.getElementById('max-authors').value = response.maxAuthors;
    }

    if (response.citeCommand) {
      document.getElementById('cite-command').value = response.citeCommand;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function savePreferences() {
  const prefs = {
    maxAuthors: parseInt(document.getElementById('max-authors').value, 10),
    citeCommand: document.getElementById('cite-command').value
  };

  try {
    await chrome.runtime.sendMessage({
      action: 'setPreferences',
      payload: prefs
    });
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

async function clearBibCache() {
  try {
    await chrome.runtime.sendMessage({ action: 'clearBibFile' });
    alert('BibTeX cache cleared successfully!');
  } catch (error) {
    alert(`Error clearing cache: ${error.message}`);
  }
}

async function clearAllCache() {
  try {
    await chrome.runtime.sendMessage({ action: 'clearCaches' });
    alert('All cached data cleared successfully!');
  } catch (error) {
    alert(`Error clearing cache: ${error.message}`);
  }
}
