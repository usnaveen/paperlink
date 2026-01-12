'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import { getUser } from '@/lib/auth';

// Theme Constants
const LCD_THEME = {
  bg: '#0055aa',
  dotInactive: 'rgba(255, 255, 255, 0.15)',
  dotActive: '#ffffff',
  glow: '0 0 8px #ffffff, 0 0 2px #ffffff'
};

const CODE_THEME = {
  bg: '#001100',
  dotInactive: 'rgba(0, 255, 0, 0.1)',
  dotActive: '#00ff00',
  glow: '0 0 12px #00ff00, 0 0 4px #00ff00'
};

// Nav button themes
const GREEN_NAV = {
  bg: '#001100',
  dotInactive: 'rgba(0, 255, 0, 0.15)',
  dotActive: '#00ff00',
  glow: '0 0 8px #00ff00'
};

const YELLOW_NAV = {
  bg: '#111100',
  dotInactive: 'rgba(255, 204, 0, 0.15)',
  dotActive: '#ffcc00',
  glow: '0 0 8px #ffcc00'
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  useEffect(() => {
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

  // Functional Dot Matrix Display
  const DotMatrixDisplay = ({ text, theme, fontSize = '16px', bold = false }: {
    text: string,
    theme: typeof LCD_THEME,
    fontSize?: string,
    bold?: boolean
  }) => (
    <div style={{
      background: theme.bg,
      borderRadius: '6px',
      border: '3px solid rgba(0,0,0,0.4)',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.1)',
      padding: '16px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `radial-gradient(circle, ${theme.dotInactive} 1px, transparent 1px)`,
        backgroundSize: '4px 4px',
        opacity: 0.8
      }} />
      <div style={{
        position: 'relative',
        fontFamily: '"Doto", monospace',
        fontSize: fontSize,
        fontWeight: bold ? 900 : 700,
        color: theme.dotActive,
        textShadow: theme.glow,
        textAlign: 'center',
        letterSpacing: '2px',
        whiteSpace: 'nowrap'
      }}>
        {text}
      </div>
    </div>
  );

  // Glittering code display
  const GlitterCodeDisplay = ({ code, theme }: { code: string, theme: typeof LCD_THEME }) => (
    <>
      <style>{`
                @keyframes glitter {
                    0%, 100% { opacity: 1; filter: brightness(1); }
                    50% { opacity: 0.9; filter: brightness(1.3); }
                }
                .glitter-code { animation: glitter 1.2s ease-in-out infinite; }
            `}</style>
      <div
        className="glitter-code"
        style={{
          background: theme.bg,
          borderRadius: '6px',
          border: '3px solid rgba(0,0,0,0.4)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
          padding: '20px',
          position: 'relative',
          cursor: 'pointer'
        }}
        onClick={copyCode}
        title="Click to copy"
      >
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `radial-gradient(circle, ${theme.dotInactive} 1px, transparent 1px)`,
          backgroundSize: '4px 4px',
          opacity: 0.8
        }} />
        <div style={{
          position: 'relative',
          fontFamily: '"Doto", monospace',
          fontSize: '28px',
          fontWeight: 900,
          color: theme.dotActive,
          textShadow: theme.glow,
          textAlign: 'center',
          letterSpacing: '3px'
        }}>
          {code}
        </div>
      </div>
    </>
  );

  // Matrix Nav Button
  const MatrixNavButton = ({ href, label, theme, isActive }: {
    href: string,
    label: string,
    theme: typeof GREEN_NAV,
    isActive: boolean
  }) => (
    <Link
      href={href}
      style={{
        flex: 1,
        background: theme.bg,
        borderRadius: '4px',
        border: '2px solid rgba(0,0,0,0.4)',
        boxShadow: isActive
          ? `inset 0 2px 8px rgba(0,0,0,0.6), 0 0 15px ${theme.dotActive}40`
          : 'inset 0 2px 8px rgba(0,0,0,0.6)',
        padding: '14px 20px',
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
        display: 'block',
        textAlign: 'center',
        opacity: isActive ? 1 : 0.5
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `radial-gradient(circle, ${theme.dotInactive} 1px, transparent 1px)`,
        backgroundSize: '4px 4px',
        opacity: isActive ? 0.8 : 0.3
      }} />
      <div style={{
        position: 'relative',
        fontFamily: '"Doto", monospace',
        fontSize: '14px',
        fontWeight: 900,
        color: isActive ? theme.dotActive : '#444',
        textShadow: isActive ? theme.glow : 'none',
        letterSpacing: '2px',
        textTransform: 'uppercase'
      }}>
        {label}
      </div>
    </Link>
  );

  return (
    <div className="container" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      justifyContent: 'center'
    }}>
      <div className="winamp-window">
        <div className="winamp-titlebar">
          <span className="winamp-titlebar-text">PAPERLINK</span>
          <AuthButton />
        </div>

        <div className="winamp-content">
          <DotMatrixDisplay
            text="BRIDGE PAPER NOTES TO DIGITAL"
            theme={LCD_THEME}
            fontSize="14px"
            bold={true}
          />

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
              <GlitterCodeDisplay code={code} theme={CODE_THEME} />
              <div className="copy-row" style={{ marginTop: '12px' }}>
                <button
                  onClick={copyCode}
                  className={`btn ${copied ? 'btn-primary copy-success' : 'btn-secondary'} copy-btn`}
                  style={{ width: '100%' }}
                >
                  {copied ? '✓ Copied to clipboard' : 'Copy Code'}
                </button>
              </div>
            </div>
          )}

          {/* Collapsible How It Works */}
          {!code && (
            <div className={howItWorksOpen ? 'card' : ''} style={{ marginTop: '12px' }}>
              <h2
                className={howItWorksOpen ? 'card-title' : ''}
                onClick={() => setHowItWorksOpen(!howItWorksOpen)}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  margin: 0,
                  color: howItWorksOpen ? '#2a3555' : '#b8c0cc',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  padding: howItWorksOpen ? undefined : '6px 12px',
                  marginBottom: howItWorksOpen ? '12px' : 0,
                  paddingBottom: howItWorksOpen ? '6px' : 0,
                  borderBottom: howItWorksOpen ? '1px solid #8090a0' : 'none'
                }}
              >
                {howItWorksOpen ? '▼' : '▶'} How It Works
              </h2>
              {howItWorksOpen && (
                <div style={{
                  background: 'linear-gradient(180deg, #1a2845 0%, #0d1829 100%)',
                  border: '1px solid #050a15',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
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
              )}
            </div>
          )}

          {/* Matrix Style Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <MatrixNavButton href="/" label="Write" theme={GREEN_NAV} isActive={true} />
            <MatrixNavButton href="/scan" label="Scan" theme={YELLOW_NAV} isActive={false} />
          </div>
        </div>
      </div>

      <div style={{
        textAlign: 'center',
        padding: '8px',
        fontSize: '10px',
        color: '#666',
        fontFamily: 'monospace',
        marginTop: '16px'
      }}>
        v0.3.1
      </div>
    </div>
  );
}
