'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Check for error from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorType = params.get('error');
    const errorCode = params.get('code');

    if (errorType === 'not_found' && errorCode) {
      setError(`Code "${errorCode}" not found`);
      // Clear URL params
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
        body: JSON.stringify({ url: url.trim() }),
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
      // Haptic feedback on supported devices
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="container">
      {/* Main Winamp Window */}
      <div className="winamp-window">
        {/* Title Bar */}
        <div className="winamp-titlebar">
          <span className="winamp-titlebar-text">PAPERLINK</span>
          <div className="winamp-titlebar-buttons">
            <div className="winamp-titlebar-btn">_</div>
            <div className="winamp-titlebar-btn">□</div>
            <div className="winamp-titlebar-btn">×</div>
          </div>
        </div>

        <div className="winamp-content">
          {/* LCD Header Display */}
          <div className="lcd-display" style={{ margin: '4px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-lcd)', fontSize: '14px' }}>
              BRIDGE YOUR PAPER NOTES TO DIGITAL
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="nav-tabs">
            <Link href="/" className="nav-tab active">
              ✍️ WRITE
            </Link>
            <Link href="/scan" className="nav-tab">
              📷 SCAN
            </Link>
          </nav>

          {/* URL Input Card */}
          <div className="card">
            <h2 className="card-title">▶ SHORTEN URL</h2>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <input
                  type="url"
                  className="input"
                  placeholder="PASTE YOUR LONG URL HERE..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading || !url.trim()}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      GENERATING...
                    </>
                  ) : (
                    '▶ GENERATE CODE'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Error Toast */}
          {error && (
            <div className="toast error">
              <span>❌</span>
              <span>{error}</span>
            </div>
          )}

          {/* Code Display */}
          {code && (
            <div className="card">
              <h2 className="card-title">▶ YOUR HANDWRITING CODE</h2>
              <div className="code-display">
                <div className="code-text">{code}</div>
                <p className="code-hint">WRITE THIS CODE IN YOUR NOTES</p>
              </div>

              <div className="copy-row">
                <button
                  onClick={copyCode}
                  className={`btn ${copied ? 'btn-primary copy-success' : 'btn-secondary'} copy-btn`}
                >
                  {copied ? '✓ COPIED!' : '📋 COPY CODE'}
                </button>
                <button
                  onClick={copyShortUrl}
                  className="btn btn-secondary btn-icon"
                  title="Copy short URL"
                >
                  🔗
                </button>
              </div>

              <div className="handwriting-guide">
                <span className="handwriting-sample">{code}</span>
                <span className="handwriting-text">
                  Write it clearly on paper. Later, scan it with the app!
                </span>
              </div>
            </div>
          )}

          {/* How it works */}
          {!code && (
            <div className="card">
              <h2 className="card-title">▶ HOW IT WORKS</h2>
              <div style={{ fontFamily: 'var(--font-lcd)', fontSize: '14px', color: 'var(--lcd-amber)', lineHeight: '1.8' }}>
                <p style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--lcd-text)' }}>1.</span> PASTE ANY URL ABOVE AND GET A SHORT CODE
                </p>
                <p style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--lcd-text)' }}>2.</span> WRITE THE CODE IN YOUR PAPER NOTES
                </p>
                <p style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--lcd-text)' }}>3.</span> LATER, USE THE{' '}
                  <Link href="/scan" style={{ color: 'var(--lcd-text)', textDecoration: 'underline' }}>
                    SCANNER
                  </Link>{' '}
                  TO SCAN YOUR HANDWRITING
                </p>
                <p>
                  <span style={{ color: 'var(--lcd-text)' }}>4.</span> INSTANTLY OPEN THE LINKED URL!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
