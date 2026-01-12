// PaperLink Popup Script - Backend Integrated Version
// Connects to PaperLink API for code generation

document.addEventListener('DOMContentLoaded', init);

// Elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const settingsSection = document.getElementById('settings-section');
const settingsToggle = document.getElementById('settings-toggle');
const apiUrlInput = document.getElementById('api-url');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsFeedback = document.getElementById('settings-feedback');
const googleSignInBtn = document.getElementById('google-signin-btn');
const anonymousBtn = document.getElementById('anonymous-btn');
const loginError = document.getElementById('login-error');
const userEmail = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const currentUrl = document.getElementById('current-url');
const generateBtn = document.getElementById('generate-btn');
const loadingState = document.getElementById('loading-state');
const codeBox = document.getElementById('code-box');
const codeValue = document.getElementById('code-value');
const copyBtn = document.getElementById('copy-btn');
const copyFeedback = document.getElementById('copy-feedback');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const savedLinksList = document.getElementById('saved-links');
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');

// State
let currentApiUrl = CONFIG.API_BASE_URL;
let currentUser = null;
let currentTabUrl = null;
let currentTabTitle = null;

// Initialize
async function init() {
    // Load saved settings
    await loadSettings();

    // Check backend connection
    await checkConnection();

    // Load user session
    await loadUserSession();

    // Get current tab URL
    await loadCurrentTab();

    // Load saved links
    await loadSavedLinks();

    // Event listeners
    settingsToggle.addEventListener('click', toggleSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    anonymousBtn.addEventListener('click', handleAnonymousLogin);
    logoutBtn.addEventListener('click', handleLogout);
    generateBtn.addEventListener('click', handleGenerateCode);
    copyBtn.addEventListener('click', handleCopy);
}

// Settings Management
async function loadSettings() {
    const result = await chrome.storage.local.get(['apiUrl']);
    if (result.apiUrl) {
        currentApiUrl = result.apiUrl;
        apiUrlInput.value = result.apiUrl;
    }
}

async function saveSettings() {
    const newUrl = apiUrlInput.value.trim();
    if (!newUrl) {
        settingsFeedback.textContent = 'Please enter a valid URL';
        settingsFeedback.className = 'feedback-text error';
        return;
    }

    try {
        new URL(newUrl); // Validate URL format
        currentApiUrl = newUrl.replace(/\/$/, ''); // Remove trailing slash
        await chrome.storage.local.set({ apiUrl: currentApiUrl });
        settingsFeedback.textContent = 'Settings saved!';
        settingsFeedback.className = 'feedback-text success';
        await checkConnection();
        setTimeout(() => {
            settingsFeedback.textContent = '';
        }, 2000);
    } catch (e) {
        settingsFeedback.textContent = 'Invalid URL format';
        settingsFeedback.className = 'feedback-text error';
    }
}

function toggleSettings() {
    settingsSection.classList.toggle('hidden');
}

// Connection Check
async function checkConnection() {
    try {
        const response = await fetch(`${currentApiUrl}/api/resolve?code=test`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        // Even a 404 means the server is running
        setConnectionStatus(true, `Connected to ${new URL(currentApiUrl).host}`);
    } catch (error) {
        setConnectionStatus(false, 'Backend not reachable');
    }
}

function setConnectionStatus(connected, message) {
    connectionStatus.className = connected ? 'connection-status connected' : 'connection-status disconnected';
    statusText.textContent = message;
}

// User Session Management
async function loadUserSession() {
    const result = await chrome.storage.local.get(['user']);
    if (result.user) {
        currentUser = result.user;
        showMainSection();
    } else {
        showLoginSection();
    }
}

async function saveUserSession(user) {
    currentUser = user;
    await chrome.storage.local.set({ user });
}

async function clearUserSession() {
    currentUser = null;
    await chrome.storage.local.remove(['user']);
}

// Current Tab
async function loadCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
        currentTabUrl = tab.url;
        currentTabTitle = tab.title || 'Untitled';

        // Truncate for display
        const displayUrl = currentTabUrl.length > 50
            ? currentTabUrl.substring(0, 50) + '...'
            : currentTabUrl;
        currentUrl.textContent = displayUrl;
        currentUrl.title = currentTabUrl;

        // Check if this URL already has a code
        await checkExistingCode();
    }
}

async function checkExistingCode() {
    if (!currentTabUrl || !currentUser) return;

    // Check local cache first
    const result = await chrome.storage.local.get(['links']);
    const links = result.links || [];
    const existing = links.find(l => l.url === currentTabUrl);

    if (existing) {
        showCode(existing.code, true);
    }
}

// UI Functions
function showLoginSection() {
    loginSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
}

function showMainSection() {
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');

    if (currentUser) {
        userEmail.textContent = currentUser.isAnonymous
            ? '👤 Anonymous'
            : currentUser.email;
    }
}

function showCode(code, isExisting = false) {
    codeBox.classList.remove('hidden');
    codeValue.textContent = code;
    errorBox.classList.add('hidden');

    if (isExisting) {
        document.querySelector('.code-hint').textContent = 'This page already has a code';
    } else {
        document.querySelector('.code-hint').textContent = 'Write this on paper to access the URL later';
    }
}

function showError(message) {
    errorBox.classList.remove('hidden');
    errorMessage.textContent = message;
    codeBox.classList.add('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}

function setLoading(loading) {
    if (loading) {
        generateBtn.classList.add('hidden');
        loadingState.classList.remove('hidden');
    } else {
        generateBtn.classList.remove('hidden');
        loadingState.classList.add('hidden');
    }
}

// Event Handlers
async function handleGoogleSignIn() {
    // Open the PaperLink web app for OAuth
    // The user will authenticate there, and we'll get the session
    loginError.textContent = '';

    try {
        // Open auth page in new tab
        const authUrl = `${currentApiUrl}?auth=extension`;
        chrome.tabs.create({ url: authUrl });

        // Show message to user
        loginError.textContent = 'Complete sign-in in the opened tab, then return here';
        loginError.className = 'feedback-text';

        // For now, we'll use anonymous mode if they return
        // Full OAuth integration requires extension identity API or OAuth2
    } catch (error) {
        loginError.textContent = 'Failed to open sign-in page';
        loginError.className = 'error-text';
    }
}

async function handleAnonymousLogin() {
    const user = {
        isAnonymous: true,
        email: null,
        userId: null,
        loggedInAt: Date.now()
    };
    await saveUserSession(user);
    showMainSection();
}

async function handleLogout() {
    await clearUserSession();
    codeBox.classList.add('hidden');
    hideError();
    showLoginSection();
}

async function handleGenerateCode() {
    if (!currentTabUrl) {
        showError('No URL to shorten');
        return;
    }

    // Don't shorten chrome:// or extension pages
    if (currentTabUrl.startsWith('chrome://') || currentTabUrl.startsWith('chrome-extension://')) {
        showError('Cannot create codes for browser pages');
        return;
    }

    hideError();
    setLoading(true);

    try {
        // Call the PaperLink API
        const response = await fetch(`${currentApiUrl}/api/shorten`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: currentTabUrl,
                userId: currentUser?.userId || null
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        const code = data.code;

        // Save to local cache
        await saveToLocalCache({
            url: currentTabUrl,
            title: currentTabTitle,
            code: code,
            shortUrl: data.shortUrl,
            createdAt: data.createdAt || new Date().toISOString(),
            isExisting: data.isExisting
        });

        // Show the code
        showCode(code, data.isExisting);

        // Load updated links
        await loadSavedLinks();

        // Get current tab and show overlay
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'showCode',
                code: code
            }).catch(() => {
                // Content script not loaded on some pages
            });
        }

    } catch (error) {
        console.error('Error generating code:', error);
        showError(error.message || 'Failed to generate code. Is the backend running?');
    } finally {
        setLoading(false);
    }
}

async function saveToLocalCache(linkData) {
    const result = await chrome.storage.local.get(['links']);
    const links = result.links || [];

    // Check if already exists
    const existingIndex = links.findIndex(l => l.url === linkData.url);
    if (existingIndex >= 0) {
        links[existingIndex] = linkData;
    } else {
        links.unshift(linkData);
    }

    // Keep only last 50
    if (links.length > 50) {
        links.pop();
    }

    await chrome.storage.local.set({ links });
}

async function handleCopy() {
    const code = codeValue.textContent;
    if (code) {
        await navigator.clipboard.writeText(code);
        copyFeedback.textContent = 'Copied!';
        setTimeout(() => {
            copyFeedback.textContent = '';
        }, 2000);
    }
}

async function loadSavedLinks() {
    const result = await chrome.storage.local.get(['links']);
    const links = result.links || [];

    savedLinksList.innerHTML = '';

    const recentLinks = links.slice(0, CONFIG.MAX_RECENT_LINKS);

    if (recentLinks.length === 0) {
        savedLinksList.innerHTML = '<li class="empty-state">No saved links yet</li>';
        return;
    }

    recentLinks.forEach(link => {
        const li = document.createElement('li');
        const displayTitle = (link.title || link.url).substring(0, 30);
        li.innerHTML = `
      <span class="link-url" title="${link.url}">${displayTitle}${displayTitle.length >= 30 ? '...' : ''}</span>
      <span class="link-code">${link.code}</span>
    `;
        li.addEventListener('click', () => {
            navigator.clipboard.writeText(link.code);
            li.classList.add('copied');
            setTimeout(() => li.classList.remove('copied'), 1000);
        });
        savedLinksList.appendChild(li);
    });
}
