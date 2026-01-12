# PaperLink Chrome Extension

A Chrome extension to save page links and generate unique reference codes.

## Features

- 📎 **Generate Unique Codes** - Create 6-character alphanumeric codes for any page
- ⌨️ **Keyboard Shortcut** - Press `Ctrl+Shift+L` (Mac: `Cmd+Shift+L`) to quickly generate codes
- 💾 **Save Links** - Automatically stores page URLs with their codes
- 🎯 **Floating Overlay** - Shows generated code at the bottom-right of the page
- 🔐 **Simple Login** - Basic authentication to keep your links private

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `paperlink-extension` folder
5. The extension icon will appear in your toolbar

## Usage

### From Popup
1. Click the PaperLink extension icon
2. Login with any email and password (min 4 characters)
3. Click **Generate Code** to create a code for the current page

### Using Hotkey
- Press `Ctrl+Shift+L` (Mac: `Cmd+Shift+L`)
- A floating overlay will appear at the bottom-right with your code

### Copy Code
- Click the 📋 button in the popup or overlay to copy the code

## File Structure

```
paperlink-extension/
├── manifest.json           # Extension configuration
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── content/
│   └── content.js          # Page overlay script
├── background/
│   └── service-worker.js   # Hotkey handler
├── styles/
│   └── content.css         # Overlay styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Development

The extension uses:
- **Manifest V3** - Latest Chrome extension format
- **Chrome Storage API** - For storing links and user data
- **Content Scripts** - For injecting the floating overlay
- **Service Worker** - For handling keyboard shortcuts

## License

MIT
