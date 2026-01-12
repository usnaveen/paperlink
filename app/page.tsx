'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import { getUser } from '@/lib/auth';

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

  return (
    <div className="container">
      <div className="winamp-window">
        {/* Title Bar with Auth */}
        <div className="winamp-titlebar">
          <span className="winamp-titlebar-text">PAPERLINK</span>
          <AuthButton />
        </div>

        <div className="winamp-content">
          <div className="lcd-display">
            <div className="lcd-text lcd-text-medium" style={{ textAlign: 'center' }}>
              BRIDGE YOUR PAPER NOTES TO DIGITAL
            </div>
          </div>

          <nav className="nav-tabs">
            <Link href="/" className="nav-tab active">Write</Link>
            <Link href="/scan" className="nav-tab">Scan</Link>
          </nav>

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
              <div className="code-display">
                <div className="code-text" style={{ cursor: 'pointer' }} onClick={copyCode} title="Click to copy">
                  {code}
                </div>
              </div>

              <div className="copy-row">
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
    </div>
  );
}
