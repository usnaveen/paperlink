'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// === PURE CSS DOT MATRIX DESIGN LAB ===
// No bitmaps. No Canvas. Just CSS and Variable Fonts.

type Theme = {
    id: string;
    name: string;
    bg: string;         // The background color of the display
    dotInactive: string; // The color of the "off" dots (grid pattern)
    dotActive: string;   // The color of the "on" dots (text color)
    glow: string;        // Text shadow for bloom effect
};

const THEMES: Theme[] = [
    {
        id: 'classic',
        name: 'Classic Green',
        bg: '#000000',
        dotInactive: 'rgba(0, 255, 0, 0.15)',
        dotActive: '#00ff00',
        glow: '0 0 10px rgba(0, 255, 0, 0.6)'
    },
    {
        id: 'amber',
        name: 'Retro Amber',
        bg: '#1a1000',
        dotInactive: 'rgba(255, 176, 0, 0.15)',
        dotActive: '#ffb000',
        glow: '0 0 10px rgba(255, 176, 0, 0.6)'
    },
    {
        id: 'cyan',
        name: 'Cyber Cyan',
        bg: '#001a1a',
        dotInactive: 'rgba(0, 255, 255, 0.15)',
        dotActive: '#00ffff',
        glow: '0 0 10px rgba(0, 255, 255, 0.6)'
    },
    {
        id: 'pink',
        name: 'Hot Pink',
        bg: '#1a001a',
        dotInactive: 'rgba(255, 0, 255, 0.15)',
        dotActive: '#ff00ff',
        glow: '0 0 12px rgba(255, 0, 255, 0.7)'
    },
    {
        id: 'red',
        name: 'Red Alert',
        bg: '#1a0000',
        dotInactive: 'rgba(255, 0, 0, 0.15)',
        dotActive: '#ff0000',
        glow: '0 0 10px rgba(255, 0, 0, 0.6)'
    },
    {
        id: 'white',
        name: 'OLED White',
        bg: '#000000',
        dotInactive: 'rgba(255, 255, 255, 0.1)',
        dotActive: '#ffffff',
        glow: '0 0 5px rgba(255, 255, 255, 0.5)'
    },
    {
        id: 'blue',
        name: 'Blueprint',
        bg: '#001133',
        dotInactive: 'rgba(100, 150, 255, 0.1)',
        dotActive: '#ffffff',
        glow: 'none'
    },
    {
        id: 'purple',
        name: 'Neon Purple',
        bg: '#110022',
        dotInactive: 'rgba(180, 0, 255, 0.15)',
        dotActive: '#d000ff',
        glow: '0 0 12px rgba(180, 0, 255, 0.7)'
    },
    {
        id: 'matrix',
        name: 'The Matrix',
        bg: '#001100',
        dotInactive: 'rgba(0, 50, 0, 0.5)',
        dotActive: '#00ff00',
        glow: '0 0 5px #00ff00'
    },
    {
        id: 'gold',
        name: 'Luxury Gold',
        bg: '#221100',
        dotInactive: 'rgba(255, 215, 0, 0.1)',
        dotActive: '#ffd700',
        glow: '0 0 8px #ffd700'
    },
    {
        id: 'lcd-blue',
        name: 'LCD Blue',
        bg: '#0055aa',
        dotInactive: 'rgba(255, 255, 255, 0.2)',
        dotActive: '#ffffff',
        glow: '0 0 4px #ffffff'
    },
];

export default function DesignLabPage() {
    const [theme, setTheme] = useState(THEMES[0]);
    const [text, setText] = useState('READY.');
    const [weight, setWeight] = useState(700); // Variable font weight

    // CSS Variables for the Theme
    const containerStyle = {
        '--bg-color': theme.bg,
        '--dot-inactive': theme.dotInactive,
        '--dot-active': theme.dotActive,
        '--glow': theme.glow,
        '--font-weight': weight,
    } as React.CSSProperties;

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#111',
                color: '#fff',
                fontFamily: 'sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '40px',
                padding: '20px'
            }}
        >
            {/* 1. THE DISPLAY UNIT */}
            <div
                className="dot-matrix-container"
                style={containerStyle}
            >
                {/* Visual Bezel/Frame */}
                <div style={{
                    background: '#0a0a0a',
                    padding: '20px',
                    borderRadius: '16px',
                    boxShadow: '0 0 0 1px #333, 0 10px 40px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0px',
                    width: '100%',
                    maxWidth: '800px' // Resizable max width
                }}>

                    {/* The Screen */}
                    <div style={{
                        background: 'var(--bg-color)',
                        // The Dot Grid Pattern
                        backgroundImage: 'radial-gradient(circle, var(--dot-inactive) 1.5px, transparent 2px)',
                        backgroundSize: '6px 6px', // Grid density
                        backgroundPosition: '0 0',

                        borderRadius: '8px',
                        border: '2px solid #222',
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)', // Depth
                        height: '160px', // Resizable height
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>



                        {/* Text Display */}
                        <div style={{
                            fontFamily: 'var(--font-doto)',
                            fontSize: '48px',
                            fontWeight: 'var(--font-weight)',
                            color: 'var(--dot-active)',
                            textShadow: 'var(--glow)',
                            letterSpacing: '2px',
                            textAlign: 'center',
                            zIndex: 2,
                            width: '100%',
                            wordBreak: 'break-word'
                        }}>
                            {text}
                        </div>

                        {/* Scanlines Overlay (Optional Touch) */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 3px)',
                            pointerEvents: 'none',
                            zIndex: 3
                        }} />

                    </div>

                    {/* Branding Label */}
                    <div style={{
                        textAlign: 'center',
                        color: '#444',
                        fontSize: '10px',
                        letterSpacing: '2px',
                        marginTop: '10px',
                        fontWeight: 600
                    }}>
                        PAPERLINK MODEL-X
                    </div>
                </div>
            </div>

            {/* 2. CONTROL PANEL */}
            <div style={{
                background: '#1a1a1a',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #333',
                width: '100%',
                maxWidth: '600px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                {/* Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Message Text</label>
                    <input
                        type="text"
                        value={text}
                        onChange={e => setText(e.target.value.toUpperCase())}
                        style={{
                            background: '#111',
                            border: '1px solid #444',
                            padding: '12px',
                            color: '#fff',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '16px',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Font Weight Slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Dot Weight (Variable Font): {weight}
                    </label>
                    <input
                        type="range"
                        min="100"
                        max="900"
                        step="100"
                        value={weight}
                        onChange={e => setWeight(Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                </div>

                {/* Theme Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Theme Selection</label>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '8px'
                    }}>
                        {THEMES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTheme(t)}
                                title={t.name}
                                style={{
                                    height: '40px',
                                    background: t.bg,
                                    border: theme.id === t.id ? `2px solid ${t.dotActive}` : '1px solid #444',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: t.dotActive,
                                    boxShadow: t.glow
                                }} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <Link href="/" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>
                ← Return to Home
            </Link>
        </div>
    );
}
