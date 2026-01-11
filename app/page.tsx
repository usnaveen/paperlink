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
      <header className="header">
        <h1 className="logo">PaperLink</h1>
        <p className="tagline">Bridge your paper notes to digital</p>
      </header>

      <nav className="nav-tabs">
        <Link href="/" className="nav-tab active">
          ✍️ Write
        </Link>
        <Link href="/scan" className="nav-tab">
          📷 Scan
        </Link>
      </nav>

      <main>
        <div className="card">
          <h2 className="card-title">Shorten a URL</h2>
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
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !url.trim()}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Generating...
                  </>
                ) : (
                  '✨ Generate Code'
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
            <h2 className="card-title">Your Handwriting Code</h2>
            <div className="code-display">
              <div className="code-text">{code}</div>
              <p className="code-hint">Write this code in your notes</p>
            </div>

            <div className="copy-row">
              <button
                onClick={copyCode}
                className={`btn ${copied ? 'btn-secondary copy-success' : 'btn-secondary'} copy-btn`}
              >
                {copied ? '✓ Copied!' : '📋 Copy Code'}
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

        {!code && (
          <div className="card">
            <h2 className="card-title">How it works</h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '12px' }}>
                <strong>1.</strong> Paste any URL above and get a short code
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>2.</strong> Write the code in your paper notes
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>3.</strong> Later, use the <Link href="/scan" style={{ color: 'var(--accent-primary)' }}>Scanner</Link> to scan your handwriting
              </p>
              <p>
                <strong>4.</strong> Instantly open the linked URL!
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
