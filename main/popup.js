// ========================================
// WhatsApp Bulk Messenger - Enhanced Version
// ========================================

// --- DOM ELEMENTS ---
const contactData = document.getElementById('contactData');
const minIntervalInput = document.getElementById('minInterval');
const maxIntervalInput = document.getElementById('maxInterval');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const statusDiv = document.getElementById('status');
const fileInput = document.getElementById('fileInput');
const importBtn = document.getElementById('importBtn');
const exportResultsBtn = document.getElementById('exportResultsBtn');
const attachmentInput = document.getElementById('attachmentInput');
const addAttachmentBtn = document.getElementById('addAttachmentBtn');
const attachmentPreview = document.getElementById('attachment-preview');
const addTemplateBtn = document.getElementById('addTemplateBtn');
const templatesContainer = document.getElementById('templates-container');
const rotationMode = document.getElementById('rotationMode');
const enableBreak = document.getElementById('enableBreak');
const breakAfter = document.getElementById('breakAfter');
const breakDuration = document.getElementById('breakDuration');

// Scrape Tab Elements
const scrapeContactsBtn = document.getElementById('scrapeContacts');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const previewScrapeBtn = document.getElementById('previewScrapeBtn');
const scrapePreviewData = document.getElementById('scrapePreviewData');
const scrapeModal = document.getElementById('scrapeModal');
const closeModalBtn = document.getElementById('closeModal');
const previewTableBody = document.getElementById('previewTableBody');
const modalExportBtn = document.getElementById('modalExportBtn');
const modalUseBtn = document.getElementById('modalUseBtn');

// Statistics Elements
const statSent = document.getElementById('stat-sent');
const statFailed = document.getElementById('stat-failed');
const statInvalid = document.getElementById('stat-invalid');
const statRemaining = document.getElementById('stat-remaining');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const scrapeTotal = document.getElementById('scrape-total');
const scrapeAdmins = document.getElementById('scrape-admins');
const scrapeUnsaved = document.getElementById('scrape-unsaved');

// Tab Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const sendTab = document.getElementById('send-tab');
const scrapeTab = document.getElementById('scrape-tab');

// --- STATE VARIABLES ---
let contacts = [];
let scrapedContacts = [];
let currentIndex = 0;
let isSending = false;
let isPaused = false;
let isScraping = false; // Continuous scrape loop state
let scrapeTimeout = null; // Track timeout for scrape loop
let messagesSentInBatch = 0;
let templateIndex = 0;
let attachments = [];
let sendTimeout = null;

let stats = {
  sent: 0,
  failed: 0,
  invalid: 0,
  notFound: 0
};

let results = []; // Track each contact's outcome

// Header Actions
const themeToggle = document.getElementById('themeToggle');
const clearAllBtn = document.getElementById('clearAllBtn');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initTheme();
  loadState();
  setupEventListeners();
});

// --- THEME MANAGEMENT ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️'; // Sun icon to switch to light
  } else {
    document.body.classList.remove('dark-mode');
    themeToggle.textContent = '🌙'; // Moon icon to switch to dark
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
}

function clearAllData() {
  console.log('Clearing all data...');
  if (confirm('Are you sure you want to clear all data? This will reset your contacts, settings, and statistics.')) {
    // Clear storage
    chrome.storage.local.clear(() => {
      // Reset inputs
      contactData.value = '';
      minIntervalInput.value = 5;
      maxIntervalInput.value = 15;

      // Reset stats
      stats = { sent: 0, failed: 0, invalid: 0, notFound: 0 };
      currentIndex = 0;

      // Reset lists
      contacts = [];
      scrapedContacts = [];
      results = [];

      // Reset scrape preview
      scrapePreviewData.value = '';
      scrapeTotal.textContent = '0';
      scrapeAdmins.textContent = '0';
      scrapeUnsaved.textContent = '0';
      exportCsvBtn.disabled = true;
      previewScrapeBtn.disabled = true;

      // Reset message templates (keep first one empty)
      templatesContainer.innerHTML = `
        <div class="template-item" data-index="0">
          <textarea id="message-0" rows="2" placeholder="Dear [Name], We are from Company XYZ..."></textarea>
        </div>
      `;
      document.getElementById('message-0').addEventListener('input', saveState);

      // Update stats UI
      updateStats();

      // Reset UI
      statusDiv.style.display = 'none';
      showStatus('All data cleared successfully', 'success');
    });
  }
}

// --- TAB NAVIGATION ---
function initTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (tab === 'send') {
        sendTab.classList.add('active');
        scrapeTab.classList.remove('active');
      } else {
        scrapeTab.classList.add('active');
        sendTab.classList.remove('active');
      }
    });
  });
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Import/Export
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);
  exportResultsBtn.addEventListener('click', exportResults);

  // Attachments
  addAttachmentBtn.addEventListener('click', () => attachmentInput.click());
  attachmentInput.addEventListener('change', handleAttachmentUpload);

  // Templates
  addTemplateBtn.addEventListener('click', addTemplate);

  // Control Buttons
  startButton.addEventListener('click', toggleSending);
  pauseButton.addEventListener('click', togglePause);

  // Scraping
  scrapeContactsBtn.addEventListener('click', toggleScraping);
  document.getElementById('updateContacts').addEventListener('click', quickUpdate);

  exportCsvBtn.addEventListener('click', () => exportToCSV(scrapedContacts));
  previewScrapeBtn.addEventListener('click', showScrapePreview);
  closeModalBtn.addEventListener('click', closeScrapePreview);
  modalExportBtn.addEventListener('click', () => exportToCSV(scrapedContacts));
  modalUseBtn.addEventListener('click', useForSending);

  // Theme Toggle
  themeToggle.addEventListener('click', toggleTheme);
  clearAllBtn.addEventListener('click', clearAllData);

  // Save state on input changes
  contactData.addEventListener('input', saveState);
  minIntervalInput.addEventListener('change', saveState);
  maxIntervalInput.addEventListener('change', saveState);
  rotationMode.addEventListener('change', saveState);
  enableBreak.addEventListener('change', saveState);
  breakAfter.addEventListener('change', saveState);
  breakDuration.addEventListener('change', saveState);
}

// --- SCRAPE LOOP (Continuous auto-scroll) ---
function toggleScraping() {
  if (isScraping) {
    stopScraping();
  } else {
    startScraping();
  }
}

async function startScraping() {
  isScraping = true;
  scrapeContactsBtn.textContent = '⏹️ Stop Scraping';

  showStatus('Starting continuous scrape — scrolling through members...', 'success');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url.includes('web.whatsapp.com')) {
      showStatus('Please open WhatsApp Web first', 'error');
      stopScraping();
      return;
    }

    // Step 1: Open the group info panel and members list
    showStatus('Opening group members panel...', 'success');
    const setupResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: async () => {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const log = (msg) => console.log('[WhatsApp Scraper] ' + msg);

        // Check if members panel is already open
        const existingItems = document.querySelectorAll('div[data-testid="cell-frame-container"], div[role="listitem"]');
        if (existingItems.length > 5) {
          log('Members panel already open');
          return { success: true, alreadyOpen: true };
        }

        // Click header to open group info
        log('Opening group info panel...');
        const header = document.querySelector('header');
        if (header) {
          header.click();
          await wait(2000);
        }

        // Find and click "members" or "View all" button
        let membersBtn = document.querySelector('div[data-testid="group-info-drawer-participants-list-button"]');
        if (!membersBtn) {
          const buttons = document.querySelectorAll('div[role="button"], span[role="button"]');
          for (const btn of buttons) {
            const txt = btn.innerText || '';
            if (txt.match(/\d+\s*members/i) || txt.toLowerCase().includes('view all')) {
              membersBtn = btn;
              break;
            }
          }
        }

        if (membersBtn) {
          membersBtn.click();
          await wait(4000);
          log('Clicked members button');
        }

        return { success: true, alreadyOpen: false };
      }
    });

    if (!setupResult?.[0]?.result?.success) {
      showStatus('Failed to open members panel', 'error');
      stopScraping();
      return;
    }

    // Step 2: Start the continuous scroll + extract loop
    scrapeLoop(currentTab.id);

  } catch (error) {
    showStatus('Error starting scrape: ' + error.message, 'error');
    console.error(error);
    stopScraping();
  }
}

function stopScraping() {
  isScraping = false;
  if (scrapeTimeout) {
    clearTimeout(scrapeTimeout);
    scrapeTimeout = null;
  }
  scrapeContactsBtn.textContent = '🔍 Scrape Group';
  scrapeContactsBtn.disabled = false;
  showStatus(`Scraping stopped. Total: ${scrapedContacts.length} contacts`, 'success');
  saveState();
}

async function scrapeLoop(tabId) {
  if (!isScraping) return;

  try {
    // Each pass: scroll a small amount, extract visible, merge
    const passResult = await chrome.scripting.executeScript({
      target: { tabId },
      function: async () => {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const log = (msg) => console.log('[WhatsApp Scraper] ' + msg);

        // Find scroll container
        let scrollContainer = null;
        const potentialItems = document.querySelectorAll('div[data-testid="cell-frame-container"], div[role="listitem"]');

        if (potentialItems.length > 0) {
          let parent = potentialItems[0].parentElement;
          let attempts = 0;
          while (parent && parent.tagName !== 'BODY' && attempts < 20) {
            const style = window.getComputedStyle(parent);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
              scrollContainer = parent;
              break;
            }
            parent = parent.parentElement;
            attempts++;
          }
        }

        if (!scrollContainer) {
          const sidePanel = document.querySelector('div[data-testid="group-info-drawer"]');
          if (sidePanel) {
            const lists = sidePanel.querySelectorAll('div');
            for (const div of lists) {
              const style = window.getComputedStyle(div);
              if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && div.scrollHeight > div.clientHeight) {
                scrollContainer = div;
                break;
              }
            }
          }
        }

        // Scroll down by a small increment
        let reachedEnd = false;
        if (scrollContainer) {
          const prevTop = scrollContainer.scrollTop;
          const prevHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop += 200;
          await wait(600);

          // Check if we've reached the bottom
          const newTop = scrollContainer.scrollTop;
          const newHeight = scrollContainer.scrollHeight;
          if (newTop === prevTop && newHeight === prevHeight) {
            reachedEnd = true;
          }
        }

        // Get group name
        let groupName = 'Unknown Group';
        const subjectInput = document.querySelector('div[contenteditable="true"][data-testid="group-info-drawer-subject-input"]');
        if (subjectInput) {
          groupName = subjectInput.innerText || subjectInput.textContent;
        }
        if (groupName === 'Unknown Group') {
          const sidePanelHeader = document.querySelector('section > div > div > div > span[dir="auto"]');
          if (sidePanelHeader) groupName = sidePanelHeader.innerText;
        }
        if (groupName === 'Unknown Group') {
          const possibleNames = document.querySelectorAll('section span[title], section header span[dir="auto"]');
          for (const el of possibleNames) {
            const text = (el.getAttribute('title') || el.innerText || '').trim();
            if (text && text.length > 0 && text.length < 100 && !text.match(/^[\+\d\s\-\(\),]+$/) && !text.includes('online') && !text.includes('click here')) {
              groupName = text;
              break;
            }
          }
        }

        // Extract currently visible contacts
        const contacts = [];
        const rows = document.querySelectorAll('div[data-testid="cell-frame-container"], div[role="listitem"]');

        rows.forEach(row => {
          const text = row.innerText;
          if (!text) return;

          const lines = text.split('\n').filter(l => l.trim().length > 0);
          if (lines.length === 0) return;
          if (lines[0].includes('Add participant') || lines[0].includes('Invite to group')) return;

          let name = lines[0];
          let phone = '';
          let isAdmin = false;
          let about = '';
          let isSaved = false;

          // Check for Admin tag
          if (text.toLowerCase().includes('group admin') || text.toLowerCase().includes('admin')) {
            isAdmin = true;
          }
          name = name.replace(/group admin/gi, '').replace(/admin/gi, '').trim();

          // === IMPROVED PHONE EXTRACTION ===

          // Strategy 1: Check title attributes on child elements
          const titleEls = row.querySelectorAll('span[title], div[title]');
          for (const el of titleEls) {
            const titleVal = el.getAttribute('title') || '';
            const cleanTitle = titleVal.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
            if (cleanTitle.match(/^\d{7,}$/)) {
              phone = titleVal.replace(/[^\d+]/g, '');
              if (!phone.startsWith('+')) phone = '+' + phone;
              // If title has the phone, the display name is the saved contact name
              if (name === titleVal.trim()) {
                isSaved = false; // Name IS the phone number
              } else {
                isSaved = true; // Name differs from phone
              }
              break;
            }
          }

          // Strategy 2: Check aria-label on child spans
          if (!phone) {
            const ariaEls = row.querySelectorAll('[aria-label]');
            for (const el of ariaEls) {
              const ariaVal = el.getAttribute('aria-label') || '';
              const cleanAria = ariaVal.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
              if (cleanAria.match(/^\d{7,}$/)) {
                phone = ariaVal.replace(/[^\d+]/g, '');
                if (!phone.startsWith('+')) phone = '+' + phone;
                isSaved = (name !== ariaVal.trim());
                break;
              }
            }
          }

          // Strategy 3: Check if the display name itself is a phone number
          if (!phone) {
            const rawName = name.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
            if (rawName.match(/^\d{7,}$/)) {
              phone = name.replace(/[^\d+]/g, '');
              if (!phone.startsWith('+')) phone = '+' + phone;
              isSaved = false;
            }
          }

          // Strategy 4: Scan secondary text lines for phone numbers
          if (!phone) {
            isSaved = true;
            phone = 'Saved Contact';

            for (let i = 1; i < lines.length; i++) {
              const l = lines[i];
              if (l.toLowerCase().includes('admin')) continue;

              const cleanL = l.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
              if (cleanL.match(/^\d{7,}$/)) {
                phone = l.replace(/[^\d+]/g, '');
                if (!phone.startsWith('+')) phone = '+' + phone;
                break;
              }

              if (!about) about = l;
            }
          } else {
            // Still grab "about" from secondary lines
            for (let i = 1; i < lines.length; i++) {
              const l = lines[i];
              if (l.toLowerCase().includes('admin')) continue;
              const cleanL = l.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
              if (cleanL.match(/^\d{7,}$/)) continue; // Skip phone lines
              if (!about) about = l;
            }
          }

          // For unsaved contacts, use the phone as the display name
          if (!isSaved && name === lines[0]) {
            // name stays as-is (the phone number) for reference
          }

          contacts.push({
            name: name,
            phone_number: phone,
            group_name: groupName,
            is_admin: isAdmin ? 'Yes' : 'No',
            is_saved: isSaved ? 'Yes' : 'No',
            about: about
          });
        });

        return { contacts, reachedEnd };
      }
    });

    if (passResult?.[0]?.result) {
      const { contacts: newContacts, reachedEnd } = passResult[0].result;
      mergeAndUpdateUI(newContacts);

      if (reachedEnd) {
        // Scroll reached bottom — do 2 more passes to be safe, then stop
        showStatus(`Reached end of list. Total: ${scrapedContacts.length} contacts`, 'success');
        stopScraping();
        return;
      }
    }

    // Schedule next scroll pass
    if (isScraping) {
      scrapeTimeout = setTimeout(() => scrapeLoop(tabId), 500);
    }

  } catch (error) {
    showStatus('Scrape error: ' + error.message, 'error');
    console.error(error);
    stopScraping();
  }
}

// --- QUICK UPDATE (No-scroll snapshot) ---
async function quickUpdate() {
  const updateBtn = document.getElementById('updateContacts');
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url.includes('web.whatsapp.com')) {
      showStatus('Please open WhatsApp Web first', 'error');
      return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = '⏳ Updating...';
    showStatus('Capturing visible contacts...', 'success');

    const snapResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: () => {
        const log = (msg) => console.log('[WhatsApp Scraper] ' + msg);

        // Get group name
        let groupName = 'Unknown Group';
        const subjectInput = document.querySelector('div[contenteditable="true"][data-testid="group-info-drawer-subject-input"]');
        if (subjectInput) {
          groupName = subjectInput.innerText || subjectInput.textContent;
        }
        if (groupName === 'Unknown Group') {
          const sidePanelHeader = document.querySelector('section > div > div > div > span[dir="auto"]');
          if (sidePanelHeader) groupName = sidePanelHeader.innerText;
        }
        if (groupName === 'Unknown Group') {
          const possibleNames = document.querySelectorAll('section span[title], section header span[dir="auto"]');
          for (const el of possibleNames) {
            const text = (el.getAttribute('title') || el.innerText || '').trim();
            if (text && text.length > 0 && text.length < 100 && !text.match(/^[\+\d\s\-\(\),]+$/) && !text.includes('online') && !text.includes('click here')) {
              groupName = text;
              break;
            }
          }
        }

        // Extract currently visible contacts (same logic as scrape)
        const contacts = [];
        const rows = document.querySelectorAll('div[data-testid="cell-frame-container"], div[role="listitem"]');

        log(`Quick update: scanning ${rows.length} visible rows`);

        rows.forEach(row => {
          const text = row.innerText;
          if (!text) return;

          const lines = text.split('\n').filter(l => l.trim().length > 0);
          if (lines.length === 0) return;
          if (lines[0].includes('Add participant') || lines[0].includes('Invite to group')) return;

          let name = lines[0];
          let phone = '';
          let isAdmin = false;
          let about = '';
          let isSaved = false;

          if (text.toLowerCase().includes('group admin') || text.toLowerCase().includes('admin')) {
            isAdmin = true;
          }
          name = name.replace(/group admin/gi, '').replace(/admin/gi, '').trim();

          // === IMPROVED PHONE EXTRACTION ===
          // Strategy 1: title attributes
          const titleEls = row.querySelectorAll('span[title], div[title]');
          for (const el of titleEls) {
            const titleVal = el.getAttribute('title') || '';
            const cleanTitle = titleVal.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
            if (cleanTitle.match(/^\d{7,}$/)) {
              phone = titleVal.replace(/[^\d+]/g, '');
              if (!phone.startsWith('+')) phone = '+' + phone;
              isSaved = (name !== titleVal.trim());
              break;
            }
          }

          // Strategy 2: aria-label
          if (!phone) {
            const ariaEls = row.querySelectorAll('[aria-label]');
            for (const el of ariaEls) {
              const ariaVal = el.getAttribute('aria-label') || '';
              const cleanAria = ariaVal.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
              if (cleanAria.match(/^\d{7,}$/)) {
                phone = ariaVal.replace(/[^\d+]/g, '');
                if (!phone.startsWith('+')) phone = '+' + phone;
                isSaved = (name !== ariaVal.trim());
                break;
              }
            }
          }

          // Strategy 3: name is a phone number
          if (!phone) {
            const rawName = name.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
            if (rawName.match(/^\d{7,}$/)) {
              phone = name.replace(/[^\d+]/g, '');
              if (!phone.startsWith('+')) phone = '+' + phone;
              isSaved = false;
            }
          }

          // Strategy 4: secondary lines
          if (!phone) {
            isSaved = true;
            phone = 'Saved Contact';
            for (let i = 1; i < lines.length; i++) {
              const l = lines[i];
              if (l.toLowerCase().includes('admin')) continue;
              const cleanL = l.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
              if (cleanL.match(/^\d{7,}$/)) {
                phone = l.replace(/[^\d+]/g, '');
                if (!phone.startsWith('+')) phone = '+' + phone;
                break;
              }
              if (!about) about = l;
            }
          } else {
            for (let i = 1; i < lines.length; i++) {
              const l = lines[i];
              if (l.toLowerCase().includes('admin')) continue;
              const cleanL = l.replace(/[\s\-\(\)\+\u00A0\u200B]/g, '');
              if (cleanL.match(/^\d{7,}$/)) continue;
              if (!about) about = l;
            }
          }

          contacts.push({
            name: name,
            phone_number: phone,
            group_name: groupName,
            is_admin: isAdmin ? 'Yes' : 'No',
            is_saved: isSaved ? 'Yes' : 'No',
            about: about
          });
        });

        log(`Quick update: extracted ${contacts.length} contacts`);
        return contacts;
      }
    });

    if (snapResult?.[0]?.result) {
      const beforeCount = scrapedContacts.length;
      mergeAndUpdateUI(snapResult[0].result);
      const addedCount = scrapedContacts.length - beforeCount;
      showStatus(`Update done! Added ${addedCount} new. Total: ${scrapedContacts.length}`, 'success');
    } else {
      showStatus('No contacts found. Open a group members panel first.', 'error');
    }

  } catch (error) {
    showStatus('Update error: ' + error.message, 'error');
    console.error(error);
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = '🔄 Update Contacts';
    saveState();
  }
}

// --- SHARED: Merge new contacts and update UI ---
function mergeAndUpdateUI(newContacts) {
  if (!newContacts || newContacts.length === 0) return;

  const map = new Map();

  // Add existing contacts
  scrapedContacts.forEach(c => {
    const key = (c.phone_number && c.phone_number !== 'Saved Contact') ? c.phone_number : c.name;
    map.set(key, c);
  });

  // Merge new contacts — update existing if new data is more complete
  newContacts.forEach(c => {
    const key = (c.phone_number && c.phone_number !== 'Saved Contact') ? c.phone_number : c.name;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, c);
    } else {
      // Update if new data has more info (e.g., phone was 'Saved Contact' before but now found)
      if (existing.phone_number === 'Saved Contact' && c.phone_number !== 'Saved Contact') {
        map.set(key, { ...existing, phone_number: c.phone_number, is_saved: c.is_saved });
      }
      if (!existing.about && c.about) {
        const merged = map.get(key);
        merged.about = c.about;
      }
    }
  });

  scrapedContacts = Array.from(map.values());

  // Update preview textarea
  scrapePreviewData.value = scrapedContacts.map(c =>
    `${c.name} | ${c.phone_number} | ${c.about || ''} | ${c.is_admin === 'Yes' ? '👑 Admin' : ''} ${c.is_saved === 'No' ? '📵 Unsaved' : '✅ Saved'}`
  ).join('\n');

  // Update statistics
  const adminCount = scrapedContacts.filter(c => c.is_admin === 'Yes').length;
  const unsavedCount = scrapedContacts.filter(c => c.is_saved === 'No').length;

  scrapeTotal.textContent = scrapedContacts.length;
  scrapeAdmins.textContent = adminCount;
  scrapeUnsaved.textContent = unsavedCount;

  // Enable export/preview
  exportCsvBtn.disabled = false;
  previewScrapeBtn.disabled = false;
}

// --- STATE PERSISTENCE ---
function saveState() {
  const templates = getTemplates();
  const state = {
    contacts: contactData.value,
    templates: templates,
    minInterval: minIntervalInput.value,
    maxInterval: maxIntervalInput.value,
    rotationMode: rotationMode.value,
    enableBreak: enableBreak.checked,
    breakAfter: breakAfter.value,
    breakDuration: breakDuration.value,
    currentIndex: currentIndex,
    stats: stats,
    results: results,
    isSending: isSending,
    isPaused: isPaused,
    scrapedContacts: scrapedContacts
  };
  chrome.storage.local.set({ bulkMessengerState: state });
}

function loadState() {
  chrome.storage.local.get(['bulkMessengerState'], (result) => {
    if (result.bulkMessengerState) {
      const state = result.bulkMessengerState;
      contactData.value = state.contacts || '';
      minIntervalInput.value = state.minInterval || 5;
      maxIntervalInput.value = state.maxInterval || 15;
      rotationMode.value = state.rotationMode || 'random';
      enableBreak.checked = state.enableBreak || false;
      breakAfter.value = state.breakAfter || 10;
      breakDuration.value = state.breakDuration || 60;

      // Restore templates
      if (state.templates && state.templates.length > 0) {
        state.templates.forEach((template, index) => {
          if (index === 0) {
            document.getElementById('message-0').value = template;
          } else {
            addTemplate(template);
          }
        });
      }

      // Restore scraped contacts
      if (state.scrapedContacts && state.scrapedContacts.length > 0) {
        scrapedContacts = state.scrapedContacts;

        // Update preview textarea
        scrapePreviewData.value = scrapedContacts.map(c =>
          `${c.name} | ${c.phone_number} | ${c.about || ''} | ${c.is_admin === 'Yes' ? '👑 Admin' : ''} ${c.is_saved === 'No' ? '📵 Unsaved' : '✅ Saved'}`
        ).join('\n');

        // Update statistics
        const adminCount = scrapedContacts.filter(c => c.is_admin === 'Yes').length;
        const unsavedCount = scrapedContacts.filter(c => c.is_saved === 'No').length;
        scrapeTotal.textContent = scrapedContacts.length;
        scrapeAdmins.textContent = adminCount;
        scrapeUnsaved.textContent = unsavedCount;

        // Enable buttons
        exportCsvBtn.disabled = false;
        previewScrapeBtn.disabled = false;
      }

      // Restore sending state
      if (state.isSending) {
        currentIndex = state.currentIndex || 0;
        stats = state.stats || { sent: 0, failed: 0, invalid: 0, notFound: 0 };
        results = state.results || [];
        isPaused = state.isPaused || false;

        contacts = parseContactsFromText(contactData.value);
        updateStats();

        if (isPaused) {
          isSending = true;
          startButton.textContent = '⏹️ Stop Sending';
          pauseButton.style.display = 'block';
          pauseButton.textContent = '▶️ Resume';
          showStatus('Paused - Click Resume to continue', 'success');
        }
      }
    }
  });
}

function getTemplates() {
  const templates = [];
  const items = templatesContainer.querySelectorAll('.template-item textarea');
  items.forEach(textarea => {
    if (textarea.value.trim()) {
      templates.push(textarea.value);
    }
  });
  return templates;
}

// --- TEMPLATE MANAGEMENT ---
function addTemplate(content = '') {
  const index = templatesContainer.children.length;
  const templateItem = document.createElement('div');
  templateItem.className = 'template-item';
  templateItem.dataset.index = index;
  templateItem.innerHTML = `
    <textarea id="message-${index}" rows="2" placeholder="Enter message template...">${content}</textarea>
    <button class="remove-template" onclick="removeTemplate(this)">×</button>
  `;
  templatesContainer.appendChild(templateItem);
  templateItem.querySelector('textarea').addEventListener('input', saveState);
}

function removeTemplate(btn) {
  const item = btn.closest('.template-item');
  if (templatesContainer.children.length > 1) {
    item.remove();
    saveState();
  }
}

// --- ATTACHMENT HANDLING ---
function handleAttachmentUpload(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      attachments.push({
        name: file.name,
        type: file.type,
        data: e.target.result
      });
      updateAttachmentPreview();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function updateAttachmentPreview() {
  attachmentPreview.innerHTML = attachments.map((att, index) => `
    <div class="attachment-item">
      📄 ${escapeHtml(att.name.substring(0, 15))}${att.name.length > 15 ? '...' : ''}
      <button class="remove-attachment" onclick="removeAttachment(${index})">×</button>
    </div>
  `).join('');
}

function removeAttachment(index) {
  attachments.splice(index, 1);
  updateAttachmentPreview();
}

// --- FILE IMPORT ---
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const data = e.target.result;
    if (file.name.endsWith('.csv')) {
      parseCSV(data);
    } else {
      parseExcel(data);
    }
  };

  if (file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
  event.target.value = '';
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(data) {
  const lines = data.split('\n');
  contacts = [];

  let startIndex = 0;
  if (lines[0] && (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('phone'))) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const parts = parseCSVLine(line);
      if (parts.length >= 1) {
        contacts.push({
          name: parts[0] || '',
          company_name: parts[1] || '',
          phone_number: parts[2] || ''
        });
      }
    }
  }
  updateContactDisplay();
}

function parseExcel(data) {
  try {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    contacts = [];
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (row && row.length > 0) {
        contacts.push({
          name: row[0] || '',
          company_name: row[1] || '',
          phone_number: row[2] || ''
        });
      }
    }
    updateContactDisplay();
  } catch (e) {
    showStatus('Error parsing Excel file: ' + e.message, 'error');
  }
}

function updateContactDisplay() {
  contactData.value = contacts.map(contact =>
    `${contact.name},${contact.company_name},${contact.phone_number}`
  ).join('\n');
  showStatus(`Imported ${contacts.length} contacts`, 'success');
  updateStats();
  saveState();
}

// --- STATISTICS ---
function updateStats() {
  const total = contacts.length;
  const remaining = total - currentIndex;

  statSent.textContent = stats.sent;
  statFailed.textContent = stats.failed;
  statInvalid.textContent = stats.invalid + stats.notFound;
  statRemaining.textContent = remaining > 0 ? remaining : 0;

  const progress = total > 0 ? ((currentIndex / total) * 100) : 0;
  progressFill.style.width = `${progress}%`;

  if (isSending) {
    progressText.textContent = `Processing ${currentIndex + 1} of ${total}`;
  } else if (currentIndex >= total && total > 0) {
    progressText.textContent = `Completed! ${stats.sent} sent, ${stats.failed + stats.invalid + stats.notFound} failed`;
  } else {
    progressText.textContent = `Ready to send (${total} contacts)`;
  }
}

function resetStats() {
  stats = { sent: 0, failed: 0, invalid: 0, notFound: 0 };
  results = [];
  currentIndex = 0;
  messagesSentInBatch = 0;
  templateIndex = 0;
  updateStats();
}

// --- SENDING CONTROL ---
function toggleSending() {
  if (isSending) {
    stopSending();
  } else {
    startSending();
  }
}

function togglePause() {
  if (isPaused) {
    resumeSending();
  } else {
    pauseSending();
  }
}

function startSending() {
  const templates = getTemplates();
  if (templates.length === 0 || !templates[0].trim()) {
    showStatus('Please enter at least one message template', 'error');
    return;
  }

  contacts = parseContactsFromText(contactData.value);
  if (contacts.length === 0) {
    showStatus('No contacts available', 'error');
    return;
  }

  // Validate intervals
  const minVal = parseInt(minIntervalInput.value) || 5;
  const maxVal = parseInt(maxIntervalInput.value) || 15;
  if (minVal < 1) {
    showStatus('Min delay must be at least 1 second', 'error');
    return;
  }
  if (maxVal < minVal) {
    showStatus('Max delay must be greater than or equal to Min delay', 'error');
    return;
  }

  resetStats();
  isSending = true;
  isPaused = false;
  startButton.textContent = '⏹️ Stop Sending';
  pauseButton.style.display = 'block';
  pauseButton.textContent = '⏸️ Pause';

  saveState();
  sendNextMessage();
}

function stopSending() {
  isSending = false;
  isPaused = false;
  if (sendTimeout) {
    clearTimeout(sendTimeout);
    sendTimeout = null;
  }
  startButton.textContent = '▶️ Start Sending';
  pauseButton.style.display = 'none';
  showStatus('Sending stopped', 'success');
  saveState();
}

function pauseSending() {
  isPaused = true;
  if (sendTimeout) {
    clearTimeout(sendTimeout);
    sendTimeout = null;
  }
  pauseButton.textContent = '▶️ Resume';
  showStatus('Paused - Click Resume to continue', 'success');
  saveState();
}

function resumeSending() {
  isPaused = false;
  pauseButton.textContent = '⏸️ Pause';
  showStatus('Resuming...', 'success');
  saveState();
  sendNextMessage();
}

function parseContactsFromText(text) {
  const lines = text.split('\n');
  const parsedContacts = [];

  for (const line of lines) {
    if (line.trim()) {
      const parts = line.split(',');
      parsedContacts.push({
        name: parts[0] ? parts[0].trim() : '',
        company_name: parts[1] ? parts[1].trim() : '',
        phone_number: parts[2] ? parts[2].trim() : ''
      });
    }
  }
  return parsedContacts;
}

// --- MESSAGE SENDING ---
async function sendNextMessage() {
  if (!isSending || isPaused || currentIndex >= contacts.length) {
    if (currentIndex >= contacts.length && isSending) {
      stopSending();
      showStatus(`Completed! Sent: ${stats.sent}, Failed: ${stats.failed + stats.invalid + stats.notFound}`, 'success');
    }
    return;
  }

  // Check for break
  if (enableBreak.checked) {
    const breakAfterCount = parseInt(breakAfter.value) || 10;
    if (messagesSentInBatch >= breakAfterCount) {
      const breakDur = (parseInt(breakDuration.value) || 60) * 1000;
      showStatus(`Taking a break for ${breakDuration.value} seconds...`, 'success');
      messagesSentInBatch = 0;
      saveState();
      sendTimeout = setTimeout(sendNextMessage, breakDur);
      return;
    }
  }

  const contact = contacts[currentIndex];
  const templates = getTemplates();

  // Select message based on rotation mode
  let messageTemplate;
  if (rotationMode.value === 'random') {
    messageTemplate = templates[Math.floor(Math.random() * templates.length)];
  } else {
    messageTemplate = templates[templateIndex % templates.length];
    templateIndex++;
  }

  const message = messageTemplate
    .replace(/\[Name\]/g, contact.name)
    .replace(/\[Company\]/g, contact.company_name);

  try {
    // Validate phone number
    if (!isValidPhoneNumber(contact.phone_number)) {
      recordResult(contact, 'invalid', 'Invalid phone number format');
      stats.invalid++;
      currentIndex++;
      updateStats();
      saveState();
      sendTimeout = setTimeout(sendNextMessage, 1000);
      return;
    }

    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    // Check if we're on WhatsApp Web
    if (!currentTab.url.includes('web.whatsapp.com')) {
      await chrome.tabs.update(currentTab.id, { url: 'https://web.whatsapp.com' });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Navigate to the specific chat
    const mode = document.getElementById('sendingMode').value;

    if (mode === 'search') {
      // --- SEARCH MODE ---
      // Improved search mode with better selectors and input simulation
      const searchResult = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        args: [contact.phone_number, message],
        function: async (phone, messageText) => {
          const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const log = (msg) => console.log('[WA Sender] ' + msg);

          // Helper function to simulate typing like a real user
          const simulateTyping = async (element, text) => {
            element.focus();

            // Type character by character to trigger WhatsApp's search listeners
            for (const char of text) {
              // 1. KeyDown
              element.dispatchEvent(new KeyboardEvent('keydown', {
                key: char,
                bubbles: true,
                cancelable: true,
                view: window
              }));

              // 2. Insert Text
              document.execCommand('insertText', false, char);

              // 3. Input Event
              const inputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: char,
                view: window
              });
              element.dispatchEvent(inputEvent);

              // 4. KeyUp
              element.dispatchEvent(new KeyboardEvent('keyup', {
                key: char,
                bubbles: true,
                cancelable: true,
                view: window
              }));

              // Small delay between keystrokes to mimic human typing
              await wait(100);
            }

            // Final settle delay
            await wait(1000);
          };

          log('Starting search mode for: ' + phone);

          // 1. Try to open new chat panel
          let panelOpened = false;
          let searchInput = null;

          // Method A: Click the new chat button (most reliable)
          log('Looking for new chat button...');

          // Updated selectors for 2024/2025 WhatsApp Web
          const newChatSelectors = [
            '[data-testid="menu-bar-new-chat"]',
            '[data-testid="chat-list-add"]',
            'div[title="New chat"]',
            'button[aria-label="New chat"]',
            'span[data-icon="new-chat-outline"]',
            'span[data-icon="chat"]'
          ];

          let newChatBtn = null;
          for (const selector of newChatSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              newChatBtn = el.closest('button') || el.closest('div[role="button"]') || el;
              log('Found new chat button with selector: ' + selector);
              break;
            }
          }

          if (newChatBtn) {
            newChatBtn.click();
            await wait(1500);
            log('Clicked new chat button');
          } else {
            log('New chat button not found, trying keyboard shortcut...');
            // Fallback: Try keyboard shortcut
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'n', code: 'KeyN', keyCode: 78, which: 78,
              ctrlKey: true, altKey: true, bubbles: true
            }));
            await wait(1500);
          }

          // 2. Find the search input
          const searchSelectors = [
            'div[contenteditable="true"][data-tab="3"]',
            '[data-testid="chat-list-search"]',
            '[data-testid="search-input-search-contacts-pane"]',
            'div[contenteditable="true"][title="Search input textbox"]',
            'div[contenteditable="true"][aria-label*="Search"]',
            'div[role="textbox"][data-tab="3"]'
          ];

          for (const selector of searchSelectors) {
            searchInput = document.querySelector(selector);
            if (searchInput) {
              log('Found search input with selector: ' + selector);
              panelOpened = true;
              break;
            }
          }

          // Last resort: check active element
          if (!searchInput) {
            const active = document.activeElement;
            if (active && active.getAttribute('contenteditable') === 'true') {
              searchInput = active;
              panelOpened = true;
              log('Using active element as search input');
            }
          }

          if (!panelOpened || !searchInput) {
            return { success: false, error: 'Could not open new chat panel. Make sure you are on WhatsApp Web main screen.' };
          }

          // 3. Type phone number using simulated typing
          log('Typing phone number: ' + phone);
          await simulateTyping(searchInput, phone);
          await wait(2000); // Wait for search results

          // 4. Find and click contact in results
          log('Looking for contact in results...');

          const resultSelectors = [
            'div[data-testid="cell-frame-container"]',
            'div[data-testid="chat-list-item"]',
            'div[role="listitem"]',
            'div[data-testid="contact-info-drawer-section-list-item"]'
          ];

          let items = [];
          for (const selector of resultSelectors) {
            items = document.querySelectorAll(selector);
            if (items.length > 0) {
              log('Found ' + items.length + ' items with selector: ' + selector);
              break;
            }
          }

          const phoneDigits = phone.replace(/[^0-9]/g, '').slice(-10);
          let targetItem = null;

          // Find matching contact
          for (const item of items) {
            const text = (item.innerText || '').toLowerCase();
            // Skip non-contact items
            if (text.includes('invite') || text.includes('not on whatsapp') ||
              text.includes('add participant') || text.includes('new group') ||
              text.includes('new community')) {
              continue;
            }
            // Check if phone matches
            if (text.includes(phoneDigits) || text.includes(phone)) {
              targetItem = item;
              log('Found exact match for phone');
              break;
            }
          }

          // Fallback: first valid contact (if only a few results)
          if (!targetItem && items.length > 0 && items.length <= 5) {
            for (const item of items) {
              const text = (item.innerText || '').toLowerCase();
              if (!text.includes('invite') && !text.includes('new group') &&
                !text.includes('new community') && text.trim().length > 0) {
                targetItem = item;
                log('Using first valid result as fallback');
                break;
              }
            }
          }

          if (!targetItem) {
            return { success: false, error: 'Contact not found. The number may not be on WhatsApp or not in your contacts.' };
          }

          // Click the contact
          targetItem.click();
          await wait(2500);
          log('Clicked on contact, waiting for chat to load...');

          // 5. Find message input
          const msgInputSelectors = [
            'div[contenteditable="true"][data-tab="10"]',
            'div[data-testid="conversation-compose-box-input"]',
            'div[contenteditable="true"][title="Type a message"]',
            'footer div[contenteditable="true"]',
            'div[aria-label="Type a message"]'
          ];

          let messageInput = null;
          for (const selector of msgInputSelectors) {
            messageInput = document.querySelector(selector);
            if (messageInput) {
              log('Found message input with selector: ' + selector);
              break;
            }
          }

          if (!messageInput) {
            return { success: false, error: 'Message input not found. Chat may not have loaded properly.' };
          }

          // 6. Type the message
          log('Typing message...');
          await simulateTyping(messageInput, messageText);

          // 7. Click send button or press Enter
          log('Clicking send button...');
          await wait(500);
          const sendBtnSelectors = [
            'button[aria-label="Send"]',
            'span[data-icon="send"]'
          ];
          let sendClicked = false;
          for (const sel of sendBtnSelectors) {
            const btn = document.querySelector(sel);
            if (btn) {
              const clickTarget = btn.closest('button') || btn;
              clickTarget.click();
              sendClicked = true;
              log('Clicked send button with selector: ' + sel);
              break;
            }
          }
          if (!sendClicked) {
            // Fallback: press Enter
            messageInput.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
              bubbles: true, cancelable: true
            }));
            log('Pressed Enter as fallback');
          }
          await wait(1000);

          log('Message sent successfully');
          return { success: true, alreadySent: true };
        }
      });


      if (!searchResult || !searchResult[0] || !searchResult[0].result || !searchResult[0].result.success) {
        const errorMsg = searchResult?.[0]?.result?.error || 'Contact not found via search';
        recordResult(contact, 'notFound', errorMsg);
        stats.notFound++;
        currentIndex++;
        updateStats();
        saveState();
        sendTimeout = setTimeout(sendNextMessage, 1000);
        return;
      }

    } else {
      // --- DIRECT LINK MODE (Standard) ---
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${contact.phone_number}&text=${encodeURIComponent(message)}`;
      await chrome.tabs.update(currentTab.id, { url: whatsappUrl });
      await new Promise(resolve => setTimeout(resolve, 6000)); // Increased wait for load
    }

    // Skip validity check if search mode already sent the message
    const alreadySent = searchResult?.[0]?.result?.alreadySent;

    // Check if the number is valid on WhatsApp (direct link mode only)
    const isNumberValid = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      function: () => {
        // Use targeted selectors instead of expensive body.innerText scan
        const invalidBanner = document.querySelector('div[data-testid="invalid-link-message"]');
        const invalidDialog = document.querySelector('div[data-testid="popup-contents"]');
        const hasInvalidText = invalidDialog && invalidDialog.innerText.includes('Phone number shared via url is invalid');
        return !(invalidBanner || hasInvalidText);
      }
    });

    if (!isNumberValid[0].result) {
      recordResult(contact, 'not_found', 'Number not on WhatsApp');
      stats.notFound++;
      showStatus(`Skipping ${contact.name} - Number not on WhatsApp`, 'error');
      currentIndex++;
      updateStats();
      saveState();
      sendTimeout = setTimeout(sendNextMessage, 1000);
      return;
    }

    // Handle attachments if any
    if (attachments.length > 0) {
      await handleAttachments(currentTab.id);
    }

    // Click send button (skip if search mode already sent)
    let sendResult;
    if (alreadySent) {
      sendResult = [{ result: true }];
    } else {
      sendResult = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: async () => {
          const maxAttempts = 30;
          let attempts = 0;

          while (attempts < maxAttempts) {
            const sendButton = document.querySelector('button[aria-label="Send"]') ||
              document.querySelector('span[data-icon="send"]')?.closest('button');
            if (sendButton) {
              sendButton.click();
              return true;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
          return false;
        }
      });
    }

    if (sendResult[0].result) {
      recordResult(contact, 'sent', 'Message sent successfully');
      stats.sent++;
      messagesSentInBatch++;
      showStatus(`✓ Message sent to ${contact.name}`, 'success');
    } else {
      recordResult(contact, 'failed', 'Could not send message');
      stats.failed++;
      showStatus(`✗ Failed to send to ${contact.name}`, 'error');
    }

    currentIndex++;
    updateStats();
    saveState();

    // Random delay
    const minDelay = parseInt(minIntervalInput.value) || 5;
    const maxDelay = parseInt(maxIntervalInput.value) || 15;
    const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;

    showStatus(`Waiting ${randomDelay / 1000}s before next message...`, 'success');
    sendTimeout = setTimeout(sendNextMessage, randomDelay);

  } catch (error) {
    recordResult(contact, 'failed', error.message);
    stats.failed++;
    showStatus(`Error with ${contact.name}: ${error.message}`, 'error');
    currentIndex++;
    updateStats();
    saveState();
    sendTimeout = setTimeout(sendNextMessage, 1000);
  }
}

async function handleAttachments(tabId) {
  // Note: Due to browser security restrictions, direct file attachment via clipboard is limited
  // This implementation provides the framework - actual attachment requires user interaction
  showStatus('Attachment support requires manual interaction with WhatsApp', 'success');
  await new Promise(resolve => setTimeout(resolve, 1000));
}

function recordResult(contact, status, message) {
  results.push({
    name: contact.name,
    company: contact.company_name,
    phone: contact.phone_number,
    status: status,
    message: message,
    timestamp: new Date().toISOString()
  });
}

// --- EXPORT RESULTS ---
function exportResults() {
  if (results.length === 0) {
    showStatus('No results to export', 'error');
    return;
  }

  const headers = ['Name', 'Company', 'Phone', 'Status', 'Message', 'Timestamp'];
  const csvRows = [headers.join(',')];

  for (const row of results) {
    const values = [
      `"${(row.name || '').replace(/"/g, '""')}"`,
      `"${(row.company || '').replace(/"/g, '""')}"`,
      `"${(row.phone || '').replace(/"/g, '""')}"`,
      `"${row.status}"`,
      `"${(row.message || '').replace(/"/g, '""')}"`,
      `"${row.timestamp}"`
    ];
    csvRows.push(values.join(','));
  }

  downloadCSV(csvRows.join('\r\n'), 'message_results');
}

// Scraping functions (startScraping, stopScraping, scrapeLoop, quickUpdate, mergeAndUpdateUI)
// are defined above in the "SCRAPE LOOP" and "QUICK UPDATE" sections.

// --- SCRAPE PREVIEW MODAL ---
function showScrapePreview() {
  previewTableBody.innerHTML = scrapedContacts.map((c, index) => {
    let status = 'Saved';
    if (c.is_admin === 'Yes') status = 'Admin';
    else if (c.is_saved === 'No') status = 'Unsaved';

    return `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(status)}</td>
      <td>${escapeHtml(c.phone_number)}</td>
      <td>${escapeHtml(c.about || '')}</td>
    </tr>
  `}).join('');

  scrapeModal.classList.add('active');
}

function closeScrapePreview() {
  scrapeModal.classList.remove('active');
}

function useForSending() {
  // Transfer scraped contacts to send tab
  const phoneContacts = scrapedContacts.filter(c => c.is_saved === 'No' && c.phone_number !== 'Saved Contact');

  if (phoneContacts.length === 0) {
    showStatus('No unsaved contacts with phone numbers to transfer', 'error');
    return;
  }

  contacts = phoneContacts.map(c => ({
    name: c.name,
    company_name: '', // Group name removed
    phone_number: c.phone_number
  }));

  contactData.value = contacts.map(c =>
    `${c.name},${c.company_name},${c.phone_number}`
  ).join('\n');

  closeScrapePreview();

  // Switch to send tab
  tabBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="send"]').classList.add('active');
  sendTab.classList.add('active');
  scrapeTab.classList.remove('active');

  updateStats();
  saveState();
  showStatus(`Transferred ${contacts.length} contacts for sending`, 'success');
}

// --- CSV EXPORT ---
function exportToCSV(data) {
  if (!data || data.length === 0) {
    showStatus('No contacts to export', 'error');
    return;
  }

  // 4 columns: Name, Phone Number, About, Status
  const headers = ['Name', 'Phone Number', 'About', 'Status'];
  const csvRows = [headers.join(',')];

  for (const row of data) {
    let status = 'Saved';
    if (row.is_admin === 'Yes') status = 'Admin';
    else if (row.is_saved === 'No') status = 'Unsaved';

    const values = [
      `"${(row.name || '').replace(/"/g, '""')}"`,
      `"${(row.phone_number || '').replace(/"/g, '""')}"`,
      `"${(row.about || '').replace(/"/g, '""')}"`,
      `"${status}"`
    ];
    csvRows.push(values.join(','));
  }

  downloadCSV(csvRows.join('\r\n'), 'whatsapp_contacts');
}

function downloadCSV(csvString, prefix) {
  const blob = new Blob(["\ufeff" + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('Exported successfully!', 'success');
}

// --- UTILITIES ---
function isValidPhoneNumber(phone) {
  return phone && phone.length >= 10 && /^[0-9+]+$/.test(phone);
}

function clearAllData() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) return;

  // Stop any active operations
  if (isScraping) stopScraping();
  if (isSending) {
    isSending = false;
    if (sendTimeout) clearTimeout(sendTimeout);
  }

  contacts = [];
  scrapedContacts = [];
  results = [];
  currentIndex = 0;
  stats = { sent: 0, failed: 0, pending: 0 };

  contactData.value = '';
  scrapePreviewData.value = '';
  scrapeTotal.textContent = '0';
  scrapeAdmins.textContent = '0';
  scrapeUnsaved.textContent = '0';

  updateStats();
  chrome.storage.local.clear();
  showStatus('All data cleared', 'success');
}

let statusTimeout = null;
function showStatus(message, type) {
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  statusDiv.className = ''; // Clear old class first
  statusDiv.style.display = ''; // Reset display if previously hidden
  statusDiv.textContent = message;
  statusDiv.className = type;

  // Auto-hide after 8 seconds (unless sending/scraping)
  if (!isSending && !isScraping) {
    statusTimeout = setTimeout(() => {
      statusDiv.className = '';
      statusDiv.style.display = 'none';
    }, 8000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// Make functions globally available
window.removeTemplate = removeTemplate;
window.removeAttachment = removeAttachment;
