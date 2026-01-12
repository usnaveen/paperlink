// PaperLink Extension Configuration
// Central configuration for API endpoints

const CONFIG = {
    // API Base URL - Change this based on environment
    // Development: http://localhost:3000
    // Production: https://paperlink-xi.vercel.app (or your deployed URL)
    API_BASE_URL: 'http://localhost:3000',

    // API Endpoints
    ENDPOINTS: {
        SHORTEN: '/api/shorten',
        RESOLVE: '/api/resolve',
        USER_LINKS: '/api/user-links'
    },

    // Extension Settings
    CODE_FORMAT: 'PL-XXX-XXX',
    MAX_RECENT_LINKS: 5,
    OVERLAY_TIMEOUT_MS: 10000,

    // Supabase (for direct auth if needed)
    SUPABASE_URL: '',  // Will be fetched from backend or set manually
    SUPABASE_ANON_KEY: ''
};

// Helper to build full API URLs
function getApiUrl(endpoint) {
    return CONFIG.API_BASE_URL + endpoint;
}

// Export for use in other scripts
if (typeof module !== 'undefined') {
    module.exports = { CONFIG, getApiUrl };
}
