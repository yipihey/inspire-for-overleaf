/**
 * Popup script for INSPIRE for Overleaf
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load bib file status
  loadBibStatus();

  // Event listeners
  document.getElementById('settings-link').addEventListener('click', openOptions);
  document.getElementById('open-overleaf').addEventListener('click', openOverleafPanel);

  // Check if we're on Overleaf
  checkOverleafTab();
}

function openOptions(e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
}

async function loadBibStatus() {
  try {
    const result = await chrome.runtime.sendMessage({ action: 'getBibFile' });

    if (result.fileName) {
      document.getElementById('bib-name').textContent = result.fileName;

      // Get paper count
      const papers = await chrome.runtime.sendMessage({ action: 'getParsedPapers' });
      if (papers.papers && papers.papers.length > 0) {
        document.getElementById('bib-count').textContent = `${papers.papers.length} papers`;
      }
    }
  } catch (error) {
    console.log('Could not load bib status:', error.message);
  }
}

async function checkOverleafTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  const isOverleaf = currentTab?.url?.includes('overleaf.com/project/');
  const openBtn = document.getElementById('open-overleaf');

  if (isOverleaf) {
    openBtn.disabled = false;
    openBtn.textContent = 'Open INSPIRE Panel';
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
