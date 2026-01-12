'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import { supabase } from '@/lib/auth';

interface UserLink {
    id: number;
    short_code: string;
    original_url: string;
    created_at: string;
    click_count: number;
}

// Theme Constants
const CODE_THEME = {
    bg: '#001100',
    dotInactive: 'rgba(0, 255, 0, 0.15)',
    dotActive: '#00ff00',
    glow: '0 0 8px #00ff00'
};

const BLUE_THEME = {
    bg: '#001144',
    dotInactive: 'rgba(51, 102, 255, 0.2)',
    dotActive: '#3366ff'
};

const YELLOW_THEME = {
    bg: '#221100',
    dotInactive: 'rgba(255, 153, 51, 0.2)',
    dotActive: '#ff9933'
};

const RED_THEME = {
    bg: '#220000',
    dotInactive: 'rgba(204, 51, 51, 0.2)',
    dotActive: '#cc3333'
};

const dotPatternStyle = (theme: typeof BLUE_THEME) => ({
    background: theme.bg,
    backgroundImage: `radial-gradient(circle, ${theme.dotInactive} 1.5px, transparent 2px)`,
    backgroundSize: '6px 6px'
});

// Swipeable Item Component
function SwipeableLinkItem({ link, onDelete, onCopy, onEdit }: { link: UserLink, onDelete: (id: number) => void, onCopy: (text: string) => void, onEdit: (link: UserLink) => void }) {
    const [offset, setOffset] = useState(0);
    const startX = useRef<number | null>(null);
    const currentX = useRef<number>(0);
    const isDragging = useRef(false);

    useEffect(() => {
        setOffset(0);
        currentX.current = 0;
    }, [link.id]);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        isDragging.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!startX.current || !isDragging.current) return;
        const diff = e.touches[0].clientX - startX.current;
        const newOffset = Math.min(0, Math.max(-180, diff));
        setOffset(newOffset);
        currentX.current = newOffset;
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
        startX.current = null;
        if (currentX.current < -90) {
            setOffset(-180);
        } else {
            setOffset(0);
        }
    };

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '4px', marginBottom: '8px' }}>
            {/* Background Actions with Dot Pattern */}
            <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '180px',
                display: 'flex',
                zIndex: 0
            }}>
                <button
                    onClick={() => {
                        onCopy(`${window.location.origin}/r/${link.short_code}`);
                        setOffset(0);
                    }}
                    style={{
                        flex: 1,
                        ...dotPatternStyle(BLUE_THEME),
                        color: BLUE_THEME.dotActive,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textShadow: '0 0 4px ' + BLUE_THEME.dotActive
                    }}
                >
                    COPY
                </button>
                <button
                    onClick={() => {
                        onEdit(link);
                        setOffset(0);
                    }}
                    style={{
                        flex: 1,
                        ...dotPatternStyle(YELLOW_THEME),
                        color: YELLOW_THEME.dotActive,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textShadow: '0 0 4px ' + YELLOW_THEME.dotActive
                    }}
                >
                    EDIT
                </button>
                <button
                    onClick={() => onDelete(link.id)}
                    style={{
                        flex: 1,
                        ...dotPatternStyle(RED_THEME),
                        color: RED_THEME.dotActive,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textShadow: '0 0 4px ' + RED_THEME.dotActive
                    }}
                >
                    DELETE
                </button>
            </div>

            {/* Foreground Card */}
            <div
                className="card"
                style={{
                    margin: 0,
                    background: 'linear-gradient(180deg, var(--metal-mid) 0%, var(--metal-darker) 100%)',
                    zIndex: 1,
                    transform: `translateX(${offset}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
                    touchAction: 'pan-y'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ width: '100%' }}>
                        {/* Code in Dot Matrix Style */}
                        <div style={{
                            ...dotPatternStyle(CODE_THEME),
                            padding: '8px 12px',
                            borderRadius: '4px',
                            marginBottom: '8px',
                            display: 'inline-block'
                        }}>
                            <span style={{
                                fontFamily: 'var(--font-doto)',
                                fontSize: '20px',
                                fontWeight: 700,
                                color: CODE_THEME.dotActive,
                                textShadow: CODE_THEME.glow,
                                letterSpacing: '2px'
                            }}>
                                {link.short_code}
                            </span>
                        </div>
                        <div style={{
                            fontSize: '13px',
                            color: 'white',
                            fontWeight: '500',
                            wordBreak: 'break-all',
                            display: '-webkit-box',
                            WebkitLineClamp: '2',
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginBottom: '4px'
                        }}>
                            {link.original_url}
                        </div>
                        <div style={{ fontSize: '11px', color: '#b8c0cc' }}>
                            {new Date(link.created_at).toLocaleDateString()} • {link.click_count || 0} clicks
                        </div>
                        <div style={{ fontSize: '10px', color: '#8090a0', marginTop: '4px', fontStyle: 'italic' }}>
                            ← Swipe left for options
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LinksPage() {
    const [links, setLinks] = useState<UserLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [editingLink, setEditingLink] = useState<UserLink | null>(null);
    const [editUrl, setEditUrl] = useState('');

    useEffect(() => {
        async function fetchLinks() {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }
            setUserId(user.id);
            const { data, error } = await supabase
                .from('links')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (!error && data) setLinks(data as UserLink[]);
            setLoading(false);
        }
        fetchLinks();

        const { data: authListener } = supabase?.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') window.location.href = '/';
        }) || { data: { subscription: { unsubscribe: () => { } } } };

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this link?')) return;
        if (!supabase) return;

        const originalLinks = [...links];
        setLinks(links.filter(link => link.id !== id));

        const { error } = await supabase.from('links').delete().eq('id', id);

        if (error) {
            console.error('Delete error', error);
            setLinks(originalLinks);
            showToast('Failed to delete. Check database permissions.', 'error');
        } else {
            showToast('Link deleted', 'success');
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        if (navigator.vibrate) navigator.vibrate(50);
        showToast('Copied to clipboard!', 'success');
    };

    const startEdit = (link: UserLink) => {
        setEditingLink(link);
        setEditUrl(link.original_url);
    };

    const saveEdit = async () => {
        if (!editingLink || !supabase) return;

        const { error } = await supabase
            .from('links')
            .update({ original_url: editUrl })
            .eq('id', editingLink.id);

        if (error) {
            showToast('Failed to update link', 'error');
        } else {
            setLinks(links.map(l => l.id === editingLink.id ? { ...l, original_url: editUrl } : l));
            showToast('Link updated successfully', 'success');
            setEditingLink(null);
        }
    };

    // LCD Blue Theme for Header
    const LCD_THEME = {
        bg: '#0055aa',
        dotInactive: 'rgba(255, 255, 255, 0.2)',
        dotActive: '#ffffff',
        glow: '0 0 4px #ffffff'
    };

    return (
        <div className="container">
            <div className="winamp-window">
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">MY LINKS</span>
                    <AuthButton />
                </div>

                <div className="winamp-content">
                    {/* Dot Matrix Header */}
                    <div style={{
                        background: LCD_THEME.bg,
                        backgroundImage: `radial-gradient(circle, ${LCD_THEME.dotInactive} 1.5px, transparent 2px)`,
                        backgroundSize: '6px 6px',
                        borderRadius: '4px',
                        border: '2px solid rgba(0,0,0,0.3)',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                        padding: '16px',
                        marginBottom: '12px',
                        textAlign: 'center'
                    }}>
                        <span style={{
                            fontFamily: 'var(--font-doto)',
                            fontSize: '16px',
                            fontWeight: 700,
                            color: LCD_THEME.dotActive,
                            textShadow: LCD_THEME.glow,
                            letterSpacing: '1px'
                        }}>
                            YOUR SAVED LINKS
                        </span>
                    </div>

                    {/* Navigation */}
                    <div style={{ marginBottom: '10px' }}>
                        <Link href="/" className="btn btn-secondary" style={{ width: '100%' }}>
                            ← Back to Home
                        </Link>
                    </div>

                    {loading ? (
                        <div className="card text-center"><span className="spinner"></span></div>
                    ) : !userId ? (
                        <div className="card text-center">
                            <h2 className="card-title">Authentication Required</h2>
                            <p className="description">Please sign in.</p>
                        </div>
                    ) : links.length === 0 ? (
                        <div className="card text-center">
                            <h2 className="card-title">No Links</h2>
                            <Link href="/" className="btn btn-primary">Create Link</Link>
                        </div>
                    ) : (
                        <div className="links-list" style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                            {links.map(link => (
                                <SwipeableLinkItem
                                    key={link.id}
                                    link={link}
                                    onDelete={handleDelete}
                                    onCopy={handleCopy}
                                    onEdit={startEdit}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingLink && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '350px' }}>
                        <h2 className="card-title">EDIT LINK</h2>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: '#b8c0cc', display: 'block', marginBottom: '4px' }}>Destination URL:</label>
                            <input
                                type="url"
                                className="input"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setEditingLink(null)} className="btn btn-secondary" style={{ flex: 1 }}>CANCEL</button>
                            <button onClick={saveEdit} className="btn btn-primary" style={{ flex: 1 }}>SAVE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    <span>{toast.type === 'success' ? '✓' : '❌'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Version */}
            <div style={{
                textAlign: 'center',
                padding: '8px',
                fontSize: '10px',
                color: '#666',
                fontFamily: 'monospace'
            }}>
                v0.3.0
            </div>
        </div>
    );
}
