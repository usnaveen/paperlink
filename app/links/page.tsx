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

// Swipeable Item Component
function SwipeableLinkItem({ link, onDelete, onCopy }: { link: UserLink, onDelete: (id: number) => void, onCopy: (text: string) => void }) {
    const [offset, setOffset] = useState(0);
    const startX = useRef<number | null>(null);
    const currentX = useRef<number>(0);
    const isDragging = useRef(false);

    // Reset offset when scrolling
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

        // Only allow swiping left (negative diff)
        // Max swipe items width approx 140px
        const newOffset = Math.min(0, Math.max(-140, diff));

        setOffset(newOffset);
        currentX.current = newOffset;
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
        startX.current = null;

        // Snap to state
        if (currentX.current < -70) {
            setOffset(-140); // Snap open
        } else {
            setOffset(0); // Snap closed
        }
    };

    return (
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '4px', marginBottom: '8px' }}>
            {/* Background Actions */}
            <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '140px',
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
                        background: '#3366ff',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                >
                    COPY
                </button>
                <button
                    onClick={() => onDelete(link.id)}
                    style={{
                        flex: 1,
                        background: '#cc3333',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                >
                    DELETE
                </button>
            </div>

            {/* Foreground Card */}
            <div
                className="card"
                style={{
                    margin: 0, // Reset card margin
                    background: 'linear-gradient(180deg, var(--metal-mid) 0%, var(--metal-darker) 100%)',
                    zIndex: 1,
                    transform: `translateX(${offset}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
                    touchAction: 'pan-y' // Allow vertical scroll, handle horizontal in JS
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{
                            fontFamily: 'var(--font-lcd)',
                            fontSize: '22px',
                            fontWeight: 'bold',
                            color: '#00ffff',
                            letterSpacing: '2px',
                            marginBottom: '6px',
                            textShadow: '1px 1px 0 #000'
                        }}>
                            {link.short_code}
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
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this link?')) return;
        if (!supabase) return;
        const { error } = await supabase.from('links').delete().eq('id', id);
        if (!error) setLinks(links.filter(link => link.id !== id));
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        if (navigator.vibrate) navigator.vibrate(50);
        alert('Copied to clipboard!');
    };

    return (
        <div className="container">
            <div className="winamp-window">
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">MY LINKS</span>
                    <AuthButton />
                </div>

                <div className="winamp-content">
                    {/* Navigation bar removed as requested */}
                    <div style={{ marginBottom: '10px' }}>
                        <Link href="/" className="btn btn-secondary" style={{ width: '100%' }}>
                            ← Back to Dashboard
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
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
