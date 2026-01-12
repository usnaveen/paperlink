// PaperLink Content Script
// Injects floating overlay on pages to display generated codes

(function () {
    'use strict';

    let overlay = null;

    // Create the overlay element
    function createOverlay(code) {
        // Remove existing overlay if present
        removeOverlay();

        overlay = document.createElement('div');
        overlay.id = 'paperlink-overlay';
        overlay.innerHTML = `
      <div class="paperlink-content">
        <span class="paperlink-icon">📎</span>
        <span class="paperlink-label">PaperLink Code:</span>
        <span class="paperlink-code">${code}</span>
        <button class="paperlink-copy" title="Copy code">📋</button>
        <button class="paperlink-close" title="Close">✕</button>
      </div>
    `;

        document.body.appendChild(overlay);

        // Event listeners
        overlay.querySelector('.paperlink-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(code).then(() => {
                const copyBtn = overlay.querySelector('.paperlink-copy');
                copyBtn.textContent = '✓';
                setTimeout(() => {
                    copyBtn.textContent = '📋';
                }, 1500);
            });
        });

        overlay.querySelector('.paperlink-close').addEventListener('click', removeOverlay);

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (overlay) {
                overlay.classList.add('paperlink-fade-out');
                setTimeout(removeOverlay, 500);
            }
        }, 10000);
    }

    // Remove the overlay
    function removeOverlay() {
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
    }

    // Listen for messages from popup or background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'showCode' && message.code) {
            createOverlay(message.code);
            sendResponse({ success: true });
        }
        return true;
    });

})();
