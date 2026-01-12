'use client';

import { useState, useEffect } from 'react';
import { signInWithEmail, signOut, getSession, onAuthStateChange } from '@/lib/auth';

interface User {
    email?: string;
    user_metadata?: {
        avatar_url?: string;
        full_name?: string;
    };
}

export default function AuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Get initial session
        getSession().then((session) => {
            setUser(session?.user || null);
            setLoading(false);
        });

        // Subscribe to auth changes
        const { data: { subscription } } = onAuthStateChange((event, session) => {
            setUser(session?.user || null);
            if (event === 'SIGNED_IN') {
                setShowModal(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setSending(true);
        setError('');

        const { error: signInError } = await signInWithEmail(email.trim());

        if (signInError) {
            setError(signInError.message);
            setSending(false);
        } else {
            setSent(true);
            setSending(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        await signOut();
        setLoading(false);
    };

    const closeModal = () => {
        setShowModal(false);
        setEmail('');
        setSent(false);
        setError('');
    };

    if (loading) {
        return (
            <div className="auth-btn" style={{ opacity: 0.5 }}>
                <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
            </div>
        );
    }

    if (!user) {
        return (
            <>
                <button
                    onClick={() => setShowModal(true)}
                    className="auth-btn"
                    title="Sign in"
                >
                    <span style={{ fontSize: '14px' }}>👤</span>
                    <span>Sign In</span>
                </button>

                {/* Login Modal */}
                {showModal && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}
                        onClick={closeModal}
                    >
                        <div
                            className="card"
                            style={{
                                maxWidth: '340px',
                                width: '100%',
                                padding: '20px',
                                background: 'linear-gradient(180deg, #2a3858 0%, #1a2845 100%)',
                                border: '2px solid #0d1829',
                                borderRadius: '6px'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="card-title" style={{ textAlign: 'center', marginBottom: '16px' }}>
                                ▶ Sign In
                            </h2>

                            {!sent ? (
                                <form onSubmit={handleEmailSubmit}>
                                    <p style={{
                                        fontSize: '12px',
                                        color: 'var(--light-gray)',
                                        marginBottom: '12px',
                                        textAlign: 'center'
                                    }}>
                                        Enter your email to receive a magic link
                                    </p>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                        style={{ marginBottom: '12px' }}
                                    />
                                    {error && (
                                        <p style={{
                                            fontSize: '11px',
                                            color: '#ff6666',
                                            marginBottom: '12px',
                                            textAlign: 'center'
                                        }}>
                                            {error}
                                        </p>
                                    )}
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ width: '100%' }}
                                        disabled={sending}
                                    >
                                        {sending ? (
                                            <>
                                                <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
                                                Sending...
                                            </>
                                        ) : (
                                            '📧 Send Magic Link'
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        fontSize: '40px',
                                        marginBottom: '12px'
                                    }}>
                                        ✉️
                                    </div>
                                    <p style={{
                                        fontFamily: 'var(--font-lcd)',
                                        fontSize: '14px',
                                        color: 'var(--lcd-text)',
                                        textShadow: '0 0 8px var(--lcd-text)',
                                        marginBottom: '12px'
                                    }}>
                                        CHECK YOUR EMAIL!
                                    </p>
                                    <p style={{
                                        fontSize: '12px',
                                        color: 'var(--light-gray)',
                                        marginBottom: '16px'
                                    }}>
                                        We sent a login link to<br />
                                        <strong style={{ color: 'var(--lcd-text)' }}>{email}</strong>
                                    </p>
                                    <button
                                        onClick={closeModal}
                                        className="btn btn-secondary"
                                        style={{ width: '100%' }}
                                    >
                                        ✓ Got it
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={handleLogout}
                className="auth-btn auth-btn-user"
                title={`Signed in as ${user.email}`}
            >
                <span style={{ fontSize: '14px' }}>👤</span>
                <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email?.split('@')[0]}
                </span>
                <span style={{ fontSize: '10px', marginLeft: '4px' }}>✕</span>
            </button>
        </div>
    );
}
