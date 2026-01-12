'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import { getUser } from '@/lib/auth';

// LCD Blue Theme for Dot Matrix
const LCD_THEME = {
  bg: '#0055aa',
  dotInactive: 'rgba(255, 255, 255, 0.2)',
  dotActive: '#ffffff',
  glow: '0 0 4px #ffffff'
};

// Green Theme for Code Display
const CODE_THEME = {
  bg: '#001100',
  dotInactive: 'rgba(0, 255, 0, 0.15)',
  dotActive: '#00ff00',
  glow: '0 0 8px #00ff00'
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Check for user
    getUser().then(user => {
      if (user) setUserId(user.id);
    });

    const params = new URLSearchParams(window.location.search);
    const errorType = params.get('error');
    const errorCode = params.get('code');

    if (errorType === 'not_found' && errorCode) {
      setError(`Code "${errorCode}" not found`);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError('');
    setCode('');

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          userId: userId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to shorten URL');
      }

      setCode(data.code);
      setShortUrl(data.shortUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyShortUrl = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch { }
  };

  // Dot Matrix Display Style
  const dotMatrixStyle = (theme: typeof LCD_THEME) => ({
    background: theme.bg,
    backgroundImage: `radial-gradient(circle, ${theme.dotInactive} 1.5px, transparent 2px)`,
    backgroundSize: '6px 6px',
    borderRadius: '4px',
    border: '2px solid rgba(0,0,0,0.3)',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60px'
  });

  const dotMatrixTextStyle = (theme: typeof LCD_THEME, size: string = '14px') => ({
    fontFamily: 'var(--font-doto)',
    fontSize: size,
    fontWeight: 700,
    color: theme.dotActive,
    textShadow: theme.glow,
    textAlign: 'center' as const,
    letterSpacing: '1px',
    wordBreak: 'break-word' as const
  });

  return (
    <div className="container" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      justifyContent: 'center',
      paddingBottom: '80px' // Space for fixed bottom nav
    }}>
      <div className="winamp-window">
        {/* Title Bar with Auth */}
        <div className="winamp-titlebar">
          <span className="winamp-titlebar-text">PAPERLINK</span>
          <AuthButton />
        </div>

        <div className="winamp-content">
          {/* NEW: Dot Matrix Display at Top */}
          <div style={dotMatrixStyle(LCD_THEME)}>
            <div style={dotMatrixTextStyle(LCD_THEME, '16px')}>
              BRIDGE YOUR PAPER NOTES TO DIGITAL
            </div>
          </div>

          {/* URL Input */}
          <div className="card">
            <h2 className="card-title">▶ Shorten URL</h2>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <input
                  type="url"
                  className="input"
                  placeholder="Paste your long URL here..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={isLoading || !url.trim()}>
                  {isLoading ? (
                    <><span className="spinner"></span> Generating...</>
                  ) : (
                    '▶ Generate Code'
                  )}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <div className="toast error">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          {code && (
            <div className="card">
              <h2 className="card-title">▶ Generated Code</h2>
              {/* NEW: Dot Matrix Code Display (Green Theme) */}
              <div style={dotMatrixStyle(CODE_THEME)}>
                <div
                  style={{ ...dotMatrixTextStyle(CODE_THEME, '28px'), cursor: 'pointer' }}
                  onClick={copyCode}
                  title="Click to copy"
                >
                  {code}
                </div>
              </div>

              <div className="copy-row" style={{ marginTop: '12px' }}>
                <button
                  onClick={copyCode}
                  className={`btn ${copied ? 'btn-primary copy-success' : 'btn-secondary'} copy-btn`}
                  style={{ width: '100%' }}
                >
                  {copied ? '✓ Copied to clipboard' : '📋 Copy Code'}
                </button>
              </div>
            </div>
          )}

          {!code && (
            <div className="card">
              <h2 className="card-title">▶ How It Works</h2>
              <div style={{ background: 'linear-gradient(180deg, #1a2845 0%, #0d1829 100%)', border: '1px solid #050a15', borderRadius: '3px', overflow: 'hidden' }}>
                <div className="playlist-item">
                  <span><span style={{ color: '#00ffcc' }}>1.</span> Paste any URL above and get a short code</span>
                </div>
                <div className="playlist-item">
                  <span><span style={{ color: '#00ffcc' }}>2.</span> Write the code in your paper notes</span>
                </div>
                <div className="playlist-item">
                  <span><span style={{ color: '#00ffcc' }}>3.</span> Use the <Link href="/scan" style={{ color: '#00ffcc', textDecoration: 'underline' }}>Scanner</Link> to scan your handwriting</span>
                </div>
                <div className="playlist-item" style={{ borderBottom: 'none' }}>
                  <span><span style={{ color: '#00ffcc' }}>4.</span> Instantly open the linked URL!</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Version Number */}
      <div style={{
        textAlign: 'center',
        padding: '8px',
        fontSize: '10px',
        color: '#666',
        fontFamily: 'monospace',
        marginTop: '16px'
      }}>
        v0.3.0
      </div>

      {/* FIXED BOTTOM NAV */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: 'var(--background)',
        borderTop: '1px solid var(--border-dark)',
        padding: '8px',
        gap: '8px'
      }}>
        <Link
          href="/"
          className="nav-tab active"
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '12px',
            borderRadius: '4px'
          }}
        >
          ✏️ Write
        </Link>
        <Link
          href="/scan"
          className="nav-tab"
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '12px',
            borderRadius: '4px'
          }}
        >
          📷 Scan
        </Link>
      </nav>
    </div>
  );
}
