'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type ScanStatus = 'idle' | 'initializing' | 'scanning' | 'processing' | 'detected' | 'redirecting' | 'error';

export default function ScanPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [detectedCode, setDetectedCode] = useState('');
    const [detectedUrl, setDetectedUrl] = useState('');
    const [manualCode, setManualCode] = useState('');
    const [cameraError, setCameraError] = useState('');

    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const workerRef = useRef<any>(null);
    const isProcessingRef = useRef(false);

    // Pattern for PaperLink codes
    const codePattern = /PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}/gi;

    // Stop camera and cleanup
    const stopCamera = () => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
            if (workerRef.current) {
                workerRef.current.terminate().catch(() => { });
            }
        };
    }, []);

    // Handle detected code
    const handleCodeDetected = async (code: string) => {
        // Stop scanning
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }

        setStatus('detected');
        setDetectedCode(code);
        setStatusText(`FOUND: ${code}`);

        // Haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        // Resolve the code
        try {
            const response = await fetch(`/api/resolve/${encodeURIComponent(code)}`);
            const data = await response.json();

            if (response.ok && data.url) {
                setDetectedUrl(data.url);
                setStatus('redirecting');
                setStatusText('OPENING LINK IN 2 SECONDS...');

                // Auto-redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = data.url;
                }, 2000);
            } else {
                setStatusText(`CODE "${code}" NOT FOUND. TRY AGAIN.`);
                setStatus('scanning');
                setTimeout(() => startScanning(), 1000);
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setStatusText('ERROR LOOKING UP CODE. TRY AGAIN.');
            setStatus('scanning');
            setTimeout(() => startScanning(), 1000);
        }
    };

    // Capture frame and run OCR
    const captureAndScan = async () => {
        if (!videoRef.current || !canvasRef.current || !workerRef.current) return;
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Check if video is ready
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                isProcessingRef.current = false;
                return;
            }

            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current frame
            ctx.drawImage(video, 0, 0);

            // Get image data for OCR
            const imageData = canvas.toDataURL('image/png');

            setStatus('processing');
            setStatusText('ANALYZING...');

            const result = await workerRef.current.recognize(imageData);
            const text = result.data.text.toUpperCase();

            // Look for PaperLink codes
            const matches = text.match(codePattern);

            if (matches && matches.length > 0) {
                const foundCode = matches[0].toUpperCase();
                isProcessingRef.current = false;
                await handleCodeDetected(foundCode);
                return;
            }

            setStatus('scanning');
            setStatusText('SCANNING... POINT AT A PL-XXX-XXX CODE');
        } catch (err) {
            console.error('OCR error:', err);
            setStatus('scanning');
            setStatusText('SCANNING...');
        }

        isProcessingRef.current = false;
    };

    // Start continuous scanning
    const startScanning = () => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
        }
        scanIntervalRef.current = setInterval(captureAndScan, 2000);
    };

    // Start camera
    const startCamera = async () => {
        try {
            setStatus('initializing');
            setStatusText('REQUESTING CAMERA ACCESS...');
            setCameraError('');

            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported on this device/browser');
            }

            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Initialize OCR worker dynamically
            setStatusText('LOADING OCR ENGINE...');

            const Tesseract = (await import('tesseract.js')).default;
            const worker = await Tesseract.createWorker('eng', 1, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setStatusText(`PROCESSING: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });

            await worker.setParameters({
                tessedit_char_whitelist: 'PLABCDEFGHJKLMNQRTUVWXY23456789-',
            });

            workerRef.current = worker;

            setStatus('scanning');
            setStatusText('POINT CAMERA AT HANDWRITTEN CODE');

            // Start scanning every 2 seconds
            startScanning();
        } catch (err) {
            console.error('Camera error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Camera error';

            if (errorMessage.includes('Permission') || errorMessage.includes('denied')) {
                setCameraError('CAMERA PERMISSION DENIED. PLEASE ENABLE CAMERA ACCESS IN YOUR BROWSER SETTINGS.');
            } else if (errorMessage.includes('not supported')) {
                setCameraError('CAMERA NOT SUPPORTED. PLEASE USE THE MANUAL ENTRY BELOW.');
            } else {
                setCameraError(`COULD NOT ACCESS CAMERA: ${errorMessage.toUpperCase()}. TRY USING MANUAL ENTRY BELOW.`);
            }
            setStatus('error');
        }
    };

    // Handle manual code entry
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualCode.trim()) return;

        const code = manualCode.toUpperCase().trim();
        await handleCodeDetected(code);
    };

    // Cancel redirect
    const cancelRedirect = () => {
        setStatus('scanning');
        setDetectedCode('');
        setDetectedUrl('');
        setStatusText('SCANNING...');
        startScanning();
    };

    return (
        <div className="container">
            {/* Main Winamp Window */}
            <div className="winamp-window">
                {/* Title Bar */}
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">PAPERLINK SCANNER</span>
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
                            SCAN YOUR HANDWRITTEN CODES
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="nav-tabs">
                        <Link href="/" className="nav-tab">
                            ✍️ WRITE
                        </Link>
                        <Link href="/scan" className="nav-tab active">
                            📷 SCAN
                        </Link>
                    </nav>

                    <main className="scanner-container">
                        {/* Idle State - Start Camera */}
                        {status === 'idle' && (
                            <div className="card text-center">
                                <h2 className="card-title">▶ CAMERA SCANNER</h2>
                                <p style={{ marginBottom: '16px', fontFamily: 'var(--font-lcd)', fontSize: '14px', color: 'var(--lcd-amber)' }}>
                                    SCAN HANDWRITTEN PAPERLINK CODES FROM YOUR NOTES
                                </p>
                                <button onClick={startCamera} className="btn btn-primary">
                                    📷 START CAMERA
                                </button>
                            </div>
                        )}

                        {/* Camera Error State */}
                        {cameraError && (
                            <div className="card" style={{ borderColor: 'var(--winamp-red)' }}>
                                <h2 className="card-title" style={{ color: 'var(--winamp-red)' }}>▶ CAMERA ERROR</h2>
                                <p style={{ marginBottom: '12px', fontFamily: 'var(--font-lcd)', fontSize: '12px', color: 'var(--winamp-red)' }}>
                                    {cameraError}
                                </p>
                                <button onClick={startCamera} className="btn btn-secondary">
                                    ↻ TRY AGAIN
                                </button>
                            </div>
                        )}

                        {/* Active Camera View */}
                        {(status !== 'idle' && !cameraError) && (
                            <>
                                {/* Video Display */}
                                <div className="video-wrapper">
                                    <video ref={videoRef} playsInline muted autoPlay />
                                    <div className="scan-overlay" />
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </div>

                                {/* Status Display */}
                                <div className={`scan-status ${status === 'detected' || status === 'redirecting' ? 'detected' : ''}`}>
                                    {status === 'initializing' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                                            <span className="spinner"></span>
                                            <span>{statusText}</span>
                                        </div>
                                    )}
                                    {status === 'scanning' && statusText}
                                    {status === 'processing' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                                            <span className="spinner"></span>
                                            <span>{statusText}</span>
                                        </div>
                                    )}
                                    {(status === 'detected' || status === 'redirecting') && (
                                        <div>
                                            <div style={{ fontSize: '16px', marginBottom: '8px' }}>✅ {statusText}</div>
                                            {detectedUrl && (
                                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>
                                                    → {detectedUrl.length > 40 ? detectedUrl.substring(0, 40) + '...' : detectedUrl}
                                                </div>
                                            )}
                                            <button onClick={cancelRedirect} className="btn btn-secondary">
                                                ✕ CANCEL
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Manual Entry Section */}
                        <div className="card" style={{ marginTop: '4px' }}>
                            <h2 className="card-title">▶ MANUAL ENTRY</h2>
                            <p style={{ marginBottom: '12px', fontFamily: 'var(--font-lcd)', fontSize: '12px', color: 'var(--text-dim)' }}>
                                CAN&apos;T SCAN? TYPE THE CODE MANUALLY:
                            </p>
                            <form onSubmit={handleManualSubmit}>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="PL-XXX-XXX"
                                        value={manualCode}
                                        onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                        style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                                    />
                                    <button type="submit" className="btn btn-secondary">
                                        ▶ GO
                                    </button>
                                </div>
                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
