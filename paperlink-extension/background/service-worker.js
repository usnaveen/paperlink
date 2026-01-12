// PaperLink Background Service Worker
// Handles keyboard shortcuts and communication between popup and content scripts

// Generate unique code
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Get stored links
async function getStoredLinks() {
    const result = await chrome.storage.local.get(['links']);
    return result.links || [];
}

// Set stored links
async function setStoredLinks(links) {
    await chrome.storage.local.set({ links });
}

// Get code for URL
async function getCodeForUrl(url) {
    const links = await getStoredLinks();
    const link = links.find(l => l.url === url);
    return link ? link.code : null;
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'generate-code') {
        try {
            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url) {
                console.log('No active tab or URL');
                return;
            }

            // Skip chrome:// and other restricted URLs
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                console.log('Cannot run on restricted URLs');
                return;
            }

            // Check if URL already has a code
            let code = await getCodeForUrl(tab.url);

            if (!code) {
                // Generate new code
                code = generateCode();

                // Save to storage
                const links = await getStoredLinks();
                links.unshift({
                    url: tab.url,
                    title: tab.title || 'Untitled',
                    code: code,
                    createdAt: Date.now()
                });

                // Keep only last 50 links
                if (links.length > 50) {
                    links.pop();
                }

                await setStoredLinks(links);
            }

            // Send message to content script to show overlay
            chrome.tabs.sendMessage(tab.id, {
                action: 'showCode',
                code: code
            }).catch(err => {
                // Content script might not be loaded on some pages
                console.log('Could not send message to tab:', err);
            });

        } catch (error) {
            console.error('Error handling command:', error);
        }
    }
});

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('PaperLink extension installed!');
    } else if (details.reason === 'update') {
        console.log('PaperLink extension updated!');
    }
});
