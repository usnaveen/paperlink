'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

type ScanStatus = 'idle' | 'initializing' | 'camera-ready' | 'capturing' | 'processing' | 'detected' | 'error';

export default function ScanPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [detectedCode, setDetectedCode] = useState('');
    const [manualCodeChars, setManualCodeChars] = useState(''); // Just the 6 characters (no PL- or dashes)
    const [cameraError, setCameraError] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);

    const streamRef = useRef<MediaStream | null>(null);
    const workerRef = useRef<any>(null);

    const codePattern = /PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}/gi;
    const validChars = '23456789ACDEFGHJKLMNPQRTUVWXY';

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsVideoReady(false);
    }, []);

    useEffect(() => {
        return () => {
            stopCamera();
            if (workerRef.current) {
                workerRef.current.terminate().catch(() => { });
            }
        };
    }, [stopCamera]);

    // Format the 6 characters into PL-XXX-XXX format
    const formatCode = (chars: string): string => {
        const clean = chars.toUpperCase().replace(/[^23456789ACDEFGHJKLMNPQRTUVWXY]/g, '').slice(0, 6);
        if (clean.length <= 3) {
            return `PL-${clean}`;
        }
        return `PL-${clean.slice(0, 3)}-${clean.slice(3)}`;
    };

    // Get display format for the input
    const getDisplayCode = (): string => {
        const chars = manualCodeChars.toUpperCase();
        const part1 = chars.slice(0, 3).padEnd(3, '_');
        const part2 = chars.slice(3, 6).padEnd(3, '_');
        return `PL-${part1}-${part2}`;
    };

    // Handle detected code - INSTANT redirect
    const handleCodeDetected = async (code: string) => {
        setStatus('detected');
        setDetectedCode(code);
        setStatusText(`Found: ${code}`);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        try {
            const response = await fetch(`/api/resolve/${encodeURIComponent(code)}`);
            const data = await response.json();

            if (response.ok && data.url) {
                // INSTANT redirect - no delay
                window.location.href = data.url;
            } else {
                setStatusText(`Code "${code}" not found. Try again.`);
                setStatus('camera-ready');
                setCapturedImage(null);
                // Don't reset isVideoReady - camera should still be working
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setStatusText('Error looking up code. Try again.');
            setStatus('camera-ready');
            setCapturedImage(null);
        }
    };

    // Capture photo and crop to scanning rectangle
    const captureAndProcess = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas) {
            setStatusText('Camera elements not ready. Try again.');
            return;
        }

        if (!workerRef.current) {
            setStatusText('OCR engine loading. Please wait...');
            return;
        }

        if (!isVideoReady || video.videoWidth === 0 || video.videoHeight === 0) {
            setStatusText('Camera still loading. Please wait a second...');
            return;
        }

        setStatus('capturing');
        setStatusText('Capturing...');

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

            // Calculate crop region (matching the scan overlay: 80% width, 25% height, centered)
            const overlayWidthPercent = 0.80;
            const overlayHeightPercent = 0.25;

            const cropWidth = video.videoWidth * overlayWidthPercent;
            const cropHeight = video.videoHeight * overlayHeightPercent;
            const cropX = (video.videoWidth - cropWidth) / 2;
            const cropY = (video.videoHeight - cropHeight) / 2;

            // Set canvas to cropped dimensions
            canvas.width = cropWidth;
            canvas.height = cropHeight;

            // Draw only the cropped region
            ctx.drawImage(
                video,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );

            const croppedImage = canvas.toDataURL('image/png');
            setCapturedImage(croppedImage);

            // Process the cropped image
            setStatus('processing');
            setStatusText('Analyzing...');

            const result = await workerRef.current.recognize(croppedImage);
            const text = result.data.text.toUpperCase();

            console.log('OCR Result:', text);

            const matches = text.match(codePattern);

            if (matches && matches.length > 0) {
                const foundCode = matches[0].toUpperCase();
                await handleCodeDetected(foundCode);
            } else {
                setStatusText('No code found. Position the code in the rectangle and try again.');
                setStatus('camera-ready');
                setTimeout(() => setCapturedImage(null), 1500);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setStatusText('Error processing image. Try again.');
            setStatus('camera-ready');
            setCapturedImage(null);
        }
    };

    // Handle video ready
    const handleVideoCanPlay = () => {
        console.log('Video can play now');
        setIsVideoReady(true);
    };

    // Start camera
    const startCamera = async () => {
        try {
            setStatus('initializing');
            setStatusText('Requesting camera access...');
            setCameraError('');
            setCapturedImage(null);
            setIsVideoReady(false);

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

            setStatusText('Accessing camera...');
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                try {
                    await video.play();
                } catch (playError) {
                    console.log('Autoplay handled:', playError);
                }
            }

            // Initialize OCR worker if not already done
            if (!workerRef.current) {
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
            }

            setStatus('camera-ready');
            setStatusText('Position code in the rectangle, then tap Capture');
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

    // Handle manual code input - only accept valid characters
    const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.toUpperCase();
        // Filter to only valid characters and limit to 6
        const filtered = input.split('').filter(c => validChars.includes(c)).slice(0, 6).join('');
        setManualCodeChars(filtered);
    };

    // Handle manual code entry
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCodeChars.length !== 6) {
            return;
        }

        const fullCode = `PL-${manualCodeChars.slice(0, 3)}-${manualCodeChars.slice(3, 6)}`;
        await handleCodeDetected(fullCode);
    };

    // Retake photo - keep camera running
    const retakePhoto = () => {
        setCapturedImage(null);
        setStatus('camera-ready');
        setStatusText('Position code in the rectangle, then tap Capture');
        // Camera and OCR worker are still running, no need to restart
    };

    const showCamera = status !== 'idle' && status !== 'error';

    return (
        <div className="container">
            <div className="winamp-window">
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">PAPERLINK SCANNER</span>
                    <div className="winamp-titlebar-buttons">
                        <div className="winamp-titlebar-btn">−</div>
                        <div className="winamp-titlebar-btn">□</div>
                        <div className="winamp-titlebar-btn">×</div>
                    </div>
                </div>

                <div className="winamp-content">
                    <div className="lcd-display">
                        <div className="lcd-text lcd-text-medium" style={{ textAlign: 'center' }}>
                            SCAN YOUR HANDWRITTEN CODES
                        </div>
                    </div>

                    <nav className="nav-tabs">
                        <Link href="/" className="nav-tab">
                            ✍️ Write
                        </Link>
                        <Link href="/scan" className="nav-tab active">
                            📷 Scan
                        </Link>
                    </nav>

                    <main className="scanner-container">
                        {/* Start Camera Button */}
                        {status === 'idle' && (
                            <div className="card text-center">
                                <h2 className="card-title">▶ Camera Scanner</h2>
                                <p style={{
                                    marginBottom: '16px',
                                    fontFamily: 'var(--font-lcd)',
                                    fontSize: '13px',
                                    color: 'var(--lcd-text)',
                                    textShadow: '0 0 8px var(--lcd-text)'
                                }}>
                                    Capture a photo of your handwritten PaperLink code
                                </p>
                                <button onClick={startCamera} className="btn btn-primary">
                                    📷 Start Camera
                                </button>
                            </div>
                        )}

                        {/* Camera Error State */}
                        {status === 'error' && cameraError && (
                            <div className="card">
                                <h2 className="card-title" style={{ color: '#cc3333' }}>▶ Camera Error</h2>
                                <p style={{
                                    marginBottom: '12px',
                                    fontFamily: 'var(--font-label)',
                                    fontSize: '12px',
                                    color: '#cc3333'
                                }}>
                                    {cameraError}
                                </p>
                                <button onClick={startCamera} className="btn btn-secondary">
                                    ↻ Try Again
                                </button>
                            </div>
                        )}

                        {/* Camera View */}
                        {showCamera && (
                            <>
                                <div className="video-wrapper">
                                    {capturedImage ? (
                                        <img
                                            src={capturedImage}
                                            alt="Captured"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                                background: '#000'
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <video
                                                ref={videoRef}
                                                playsInline
                                                muted
                                                autoPlay
                                                onCanPlay={handleVideoCanPlay}
                                                onLoadedMetadata={handleVideoCanPlay}
                                                onPlaying={handleVideoCanPlay}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    display: status === 'initializing' ? 'none' : 'block'
                                                }}
                                            />
                                            {status === 'initializing' && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    height: '100%',
                                                    background: '#000'
                                                }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <span className="spinner"></span>
                                                        <div style={{
                                                            fontFamily: 'var(--font-lcd)',
                                                            fontSize: '14px',
                                                            color: 'var(--lcd-text)',
                                                            marginTop: '10px'
                                                        }}>
                                                            {statusText}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {status !== 'initializing' && <div className="scan-overlay" />}
                                        </>
                                    )}
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </div>

                                {/* Status Display */}
                                <div className={`scan-status ${status === 'detected' ? 'detected' : ''}`}>
                                    {status === 'initializing' && (
                                        <div style={{ fontSize: '12px', color: 'var(--light-gray)' }}>
                                            Setting up camera...
                                        </div>
                                    )}
                                    {status === 'camera-ready' && !capturedImage && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                            <span>{statusText}</span>
                                            <button
                                                onClick={captureAndProcess}
                                                className="btn btn-primary"
                                                style={{ marginTop: '8px' }}
                                                disabled={!isVideoReady}
                                            >
                                                {isVideoReady ? '📸 Capture & Scan' : '⏳ Camera loading...'}
                                            </button>
                                        </div>
                                    )}
                                    {status === 'camera-ready' && capturedImage && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                            <span>{statusText}</span>
                                            <button onClick={retakePhoto} className="btn btn-secondary">
                                                ↻ Retake Photo
                                            </button>
                                        </div>
                                    )}
                                    {(status === 'capturing' || status === 'processing') && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                                            <span className="spinner"></span>
                                            <span>{statusText}</span>
                                        </div>
                                    )}
                                    {status === 'detected' && (
                                        <div>
                                            <div style={{ fontSize: '16px', marginBottom: '8px' }}>✅ {statusText}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--light-gray)' }}>
                                                Redirecting...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Manual Entry - Auto-formatted */}
                        <div className="card">
                            <h2 className="card-title">▶ Manual Entry</h2>
                            <p style={{
                                marginBottom: '12px',
                                fontFamily: 'var(--font-label)',
                                fontSize: '11px',
                                color: 'var(--light-gray)'
                            }}>
                                Type the 6 characters (no need to type PL- or dashes):
                            </p>
                            <form onSubmit={handleManualSubmit}>
                                <div className="input-group">
                                    {/* Display formatted code */}
                                    <div style={{
                                        fontFamily: 'var(--font-lcd)',
                                        fontSize: '24px',
                                        color: 'var(--lcd-text)',
                                        textShadow: '0 0 8px var(--lcd-text)',
                                        textAlign: 'center',
                                        padding: '12px',
                                        background: 'linear-gradient(180deg, var(--lcd-bg-light) 0%, var(--lcd-bg-dark) 100%)',
                                        border: '2px solid var(--shadow-deep)',
                                        borderRadius: '3px',
                                        letterSpacing: '4px',
                                        marginBottom: '10px'
                                    }}>
                                        {getDisplayCode()}
                                    </div>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Type 6 characters..."
                                        value={manualCodeChars}
                                        onChange={handleManualInput}
                                        maxLength={6}
                                        style={{
                                            textTransform: 'uppercase',
                                            letterSpacing: '3px',
                                            textAlign: 'center',
                                            fontSize: '18px'
                                        }}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="characters"
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={manualCodeChars.length !== 6}
                                    >
                                        {manualCodeChars.length === 6 ? '▶ Go' : `${manualCodeChars.length}/6 chars`}
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
