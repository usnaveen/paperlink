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
        setStatusText(`Found: ${code}`);

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
                setStatusText('Opening link in 2 seconds...');

                // Auto-redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = data.url;
                }, 2000);
            } else {
                setStatusText(`Code "${code}" not found. Try again.`);
                setStatus('scanning');
                setTimeout(() => startScanning(), 1000);
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setStatusText('Error looking up code. Try again.');
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
            setStatusText('Analyzing...');

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
            setStatusText('Scanning... Point at a PL-XXX-XXX code');
        } catch (err) {
            console.error('OCR error:', err);
            setStatus('scanning');
            setStatusText('Scanning...');
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
            setStatusText('Requesting camera access...');
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
            setStatusText('Loading OCR engine...');

            const Tesseract = (await import('tesseract.js')).default;
            const worker = await Tesseract.createWorker('eng', 1, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setStatusText(`Processing: ${Math.round(m.progress * 100)}%`);
                    }
                },
            });

            await worker.setParameters({
                tessedit_char_whitelist: 'PLABCDEFGHJKLMNQRTUVWXY23456789-',
            });

            workerRef.current = worker;

            setStatus('scanning');
            setStatusText('Point camera at handwritten code');

            // Start scanning every 2 seconds
            startScanning();
        } catch (err) {
            console.error('Camera error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Camera error';

            if (errorMessage.includes('Permission') || errorMessage.includes('denied')) {
                setCameraError('Camera permission denied. Please enable camera access in your browser settings.');
            } else if (errorMessage.includes('not supported')) {
                setCameraError('Camera not supported. Please use the manual entry below.');
            } else {
                setCameraError(`Could not access camera: ${errorMessage}. Try using manual entry below.`);
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
        setStatusText('Scanning...');
        startScanning();
    };

    return (
        <div className="container">
            <header className="header">
                <h1 className="logo">PaperLink</h1>
                <p className="tagline">Scan your handwritten codes</p>
            </header>

            <nav className="nav-tabs">
                <Link href="/" className="nav-tab">
                    ✍️ Write
                </Link>
                <Link href="/scan" className="nav-tab active">
                    📷 Scan
                </Link>
            </nav>

            <main className="scanner-container">
                {status === 'idle' && (
                    <div className="card text-center">
                        <h2 className="card-title">Camera Scanner</h2>
                        <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                            Scan handwritten PaperLink codes from your notes
                        </p>
                        <button onClick={startCamera} className="btn btn-primary">
                            📷 Start Camera
                        </button>
                    </div>
                )}

                {cameraError && (
                    <div className="card" style={{ borderColor: 'var(--error)' }}>
                        <h2 className="card-title" style={{ color: 'var(--error)' }}>Camera Error</h2>
                        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                            {cameraError}
                        </p>
                        <button onClick={startCamera} className="btn btn-secondary">
                            Try Again
                        </button>
                    </div>
                )}

                {(status !== 'idle' && !cameraError) && (
                    <>
                        <div className="video-wrapper">
                            <video ref={videoRef} playsInline muted autoPlay />
                            <div className="scan-overlay" />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>

                        <div className={`scan-status ${status === 'detected' || status === 'redirecting' ? 'detected' : ''}`}>
                            {status === 'initializing' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                                    <span className="spinner"></span>
                                    <span>{statusText}</span>
                                </div>
                            )}
                            {status === 'scanning' && statusText}
                            {status === 'processing' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                                    <span className="spinner"></span>
                                    <span>{statusText}</span>
                                </div>
                            )}
                            {(status === 'detected' || status === 'redirecting') && (
                                <div>
                                    <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>✅ {statusText}</div>
                                    {detectedUrl && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                            → {detectedUrl.length > 50 ? detectedUrl.substring(0, 50) + '...' : detectedUrl}
                                        </div>
                                    )}
                                    <button onClick={cancelRedirect} className="btn btn-secondary">
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Manual entry fallback */}
                <div className="card" style={{ marginTop: '20px' }}>
                    <h2 className="card-title">Manual Entry</h2>
                    <p style={{ marginBottom: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Can&apos;t scan? Type the code manually:
                    </p>
                    <form onSubmit={handleManualSubmit}>
                        <div className="input-group">
                            <input
                                type="text"
                                className="input"
                                placeholder="PL-XXX-XXX"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                            />
                            <button type="submit" className="btn btn-secondary">
                                Go →
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
