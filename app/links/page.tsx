'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import { supabase } from '@/lib/auth'; // Using direct client for client-side data fetching

interface UserLink {
    id: number;
    short_code: string;
    original_url: string;
    created_at: string;
    click_count: number;
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

            if (!error && data) {
                setLinks(data as UserLink[]);
            }
            setLoading(false);
        }

        fetchLinks();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this link?')) return;
        if (!supabase) return;

        const { error } = await supabase
            .from('links')
            .delete()
            .eq('id', id);

        if (!error) {
            setLinks(links.filter(link => link.id !== id));
        }
    };

    return (
        <div className="container">
            <div className="winamp-window">
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">MY LINKS</span>
                    <AuthButton />
                </div>

                <div className="winamp-content">
                    <nav className="nav-tabs">
                        <Link href="/" className="nav-tab">Write</Link>
                        <Link href="/scan" className="nav-tab">Scan</Link>
                        <Link href="/links" className="nav-tab active">My Links</Link>
                    </nav>

                    {loading ? (
                        <div className="card text-center">
                            <span className="spinner"></span>
                        </div>
                    ) : !userId ? (
                        <div className="card text-center">
                            <h2 className="card-title">Authentication Required</h2>
                            <p className="description">Please sign in to view your saved links.</p>
                        </div>
                    ) : links.length === 0 ? (
                        <div className="card text-center">
                            <h2 className="card-title">No Links Found</h2>
                            <p className="description" style={{ marginBottom: '20px' }}>You haven't created any links yet.</p>
                            <Link href="/" className="btn btn-primary">Create Your First Link</Link>
                        </div>
                    ) : (
                        <div className="links-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {links.map(link => (
                                <div key={link.id} className="card" style={{ padding: '12px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{
                                                fontFamily: 'var(--font-lcd)',
                                                fontSize: '18px',
                                                color: 'var(--lcd-text)',
                                                letterSpacing: '2px',
                                                marginBottom: '4px'
                                            }}>
                                                {link.short_code}
                                            </div>
                                            <div style={{
                                                fontSize: '12px',
                                                color: 'var(--light-gray)',
                                                wordBreak: 'break-all',
                                                display: '-webkit-box',
                                                WebkitLineClamp: '2',
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {link.original_url}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                                                {new Date(link.created_at).toLocaleDateString()} • {link.click_count || 0} clicks
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(link.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                fontSize: '16px',
                                                cursor: 'pointer',
                                                opacity: 0.6,
                                                padding: '4px'
                                            }}
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
