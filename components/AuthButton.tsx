'use client';

import { useState, useEffect } from 'react';
import { signInWithGoogle, signOut, getSession, onAuthStateChange } from '@/lib/auth';

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
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        // Get initial session
        getSession().then((session) => {
            setUser(session?.user || null);
            setLoading(false);
        });

        // Subscribe to auth changes
        const { data: { subscription } } = onAuthStateChange((event, session) => {
            setUser(session?.user || null);
            if (event === 'SIGNED_OUT') {
                setShowMenu(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async () => {
        setLoading(true);
        await signInWithGoogle();
        // Redirect happens automatically
    };

    const handleLogout = async () => {
        setLoading(true);
        await signOut();
        setLoading(false);
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
            <button
                onClick={handleLogin}
                className="auth-btn"
                title="Sign in with Google"
            >
                <span style={{ fontSize: '14px' }}>G</span>
                <span>Sign In</span>
            </button>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="auth-btn auth-btn-user"
                title={user.email}
            >
                {user.user_metadata?.avatar_url ? (
                    <img
                        src={user.user_metadata.avatar_url}
                        alt="Avatar"
                        style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                    />
                ) : (
                    <span style={{ fontSize: '14px' }}>👤</span>
                )}
                <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
                <span style={{ fontSize: '10px', marginLeft: '4px' }}>▼</span>
            </button>

            {showMenu && (
                <div className="auth-menu">
                    <a href="/links" className="auth-menu-item" style={{ display: 'block', width: '100%', textDecoration: 'none', textAlign: 'left' }}>
                        My Links
                    </a>
                    <div style={{ height: '1px', background: 'var(--border-dark)', margin: '4px 0' }}></div>
                    <button onClick={handleLogout} className="auth-menu-item">
                        Sign Out
                    </button>
                </div>
            )}

            {/* Backdrop to close menu */}
            {showMenu && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                    onClick={() => setShowMenu(false)}
                />
            )}
        </div>
    );
}
