'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';

type ScanStatus = 'idle' | 'initializing' | 'camera-ready' | 'capturing' | 'processing' | 'detected' | 'error';

export default function ScanPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [detectedCode, setDetectedCode] = useState('');
    const [manualCodeChars, setManualCodeChars] = useState('');
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

    // Full reset to initial state
    const resetToInitial = useCallback(() => {
        stopCamera();
        setCapturedImage(null);
        setStatus('idle');
        setStatusText('');
        setCameraError('');
        setDetectedCode('');
    }, [stopCamera]);

    useEffect(() => {
        return () => {
            stopCamera();
            if (workerRef.current) {
                workerRef.current.terminate().catch(() => { });
            }
        };
    }, [stopCamera]);

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
                window.location.href = data.url;
            } else {
                setStatusText(`Code "${code}" not found.`);
                // Reset to initial state after 1.5 seconds
                setTimeout(() => {
                    resetToInitial();
                }, 1500);
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setStatusText('Error looking up code.');
            setTimeout(() => {
                resetToInitial();
            }, 1500);
        }
    };

    // Capture photo and crop to scanning rectangle
    const captureAndProcess = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !workerRef.current) {
            setStatusText('Not ready. Please wait...');
            return;
        }

        if (!isVideoReady || video.videoWidth === 0 || video.videoHeight === 0) {
            setStatusText('Camera loading...');
            return;
        }

        setStatus('capturing');
        setStatusText('Capturing...');

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const overlayWidthPercent = 0.80;
            const overlayHeightPercent = 0.25;

            const cropWidth = video.videoWidth * overlayWidthPercent;
            const cropHeight = video.videoHeight * overlayHeightPercent;
            const cropX = (video.videoWidth - cropWidth) / 2;
            const cropY = (video.videoHeight - cropHeight) / 2;

            canvas.width = cropWidth;
            canvas.height = cropHeight;
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // Apply Pre-processing (Grayscale + Binary)
            const processedImage = preprocessImage(canvas);

            setCapturedImage(processedImage);

            setStatus('processing');
            setStatusText('Analyzing...');

            const result = await workerRef.current.recognize(processedImage);
            const text = result.data.text.toUpperCase();
            console.log('OCR Result:', text);

            const matches = text.match(codePattern);

            if (matches && matches.length > 0) {
                await handleCodeDetected(matches[0].toUpperCase());
            } else {
                setStatusText('No code found. Try again.');
                // Reset to initial state
                setTimeout(() => {
                    resetToInitial();
                }, 1500);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setStatusText('Error. Try again.');
            setTimeout(() => {
                resetToInitial();
            }, 1500);
        }
    };

    const handleVideoCanPlay = () => {
        setIsVideoReady(true);
    };

    const startCamera = async () => {
        try {
            setStatus('initializing');
            setStatusText('Requesting camera access...');
            setCameraError('');
            setCapturedImage(null);
            setIsVideoReady(false);

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => { });
            }

            if (!workerRef.current) {
                setStatusText('Loading OCR engine...');
                const { default: Tesseract, PSM } = await import('tesseract.js');
                const worker = await Tesseract.createWorker('eng', 1);
                // PSM 7 = Treat the image as a single text line.
                await worker.setParameters({
                    tessedit_char_whitelist: 'PLABCDEFGHJKLMNQRTUVWXY23456789-',
                    tessedit_pageseg_mode: PSM.SINGLE_LINE,
                });
                workerRef.current = worker;
            }

            setStatus('camera-ready');
            setStatusText('Position code in rectangle, tap Capture');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Camera error';
            setCameraError(msg.includes('Permission') ? 'Camera permission denied.' : `Camera error: ${msg}`);
            setStatus('error');
        }
    };

    const preprocessImage = (canvas: HTMLCanvasElement): string => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas.toDataURL('image/png');

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Binarization threshold (adjust 0-255)
        const threshold = 110;

        for (let i = 0; i < data.length; i += 4) {
            // Grayscale
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            // Simple Binarization (High Contrast)
            const val = gray > threshold ? 255 : 0;

            data[i] = val;     // R
            data[i + 1] = val; // G
            data[i + 2] = val; // B
            // Alpha (data[i+3]) remains 255
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    };

    // Handle keyboard input for manual code
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const key = e.key.toUpperCase();

        if (e.key === 'Backspace') {
            setManualCodeChars(prev => prev.slice(0, -1));
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter' && manualCodeChars.length === 6) {
            handleManualSubmit();
            e.preventDefault();
            return;
        }

        if (validChars.includes(key) && manualCodeChars.length < 6) {
            setManualCodeChars(prev => prev + key);
            e.preventDefault();
        }
    };

    const handleManualSubmit = async () => {
        if (manualCodeChars.length !== 6) return;
        const fullCode = `PL-${manualCodeChars.slice(0, 3)}-${manualCodeChars.slice(3, 6)}`;
        await handleCodeDetected(fullCode);
    };

    // Format display value
    const getFormattedDisplay = () => {
        const chars = manualCodeChars.padEnd(6, '_');
        return `PL-${chars.slice(0, 3)}-${chars.slice(3, 6)}`;
    };

    const showCamera = status !== 'idle' && status !== 'error';

    return (
        <div className="container">
            <div className="winamp-window">
                {/* Title Bar - No window buttons */}
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">PAPERLINK SCANNER</span>
                    <AuthButton />
                </div>

                <div className="winamp-content">
                    <div className="lcd-display">
                        <div className="lcd-text lcd-text-medium" style={{ textAlign: 'center' }}>
                            SCAN YOUR HANDWRITTEN CODES
                        </div>
                    </div>

                    <nav className="nav-tabs">
                        <Link href="/" className="nav-tab">Write</Link>
                        <Link href="/scan" className="nav-tab active">Scan</Link>
                    </nav>

                    <main className="scanner-container">
                        {/* Start Camera */}
                        {status === 'idle' && (
                            <div className="card text-center">
                                <h2 className="card-title">▶ Camera Scanner</h2>
                                <p style={{ marginBottom: '16px', fontFamily: 'var(--font-lcd)', fontSize: '13px', color: 'var(--lcd-text)', textShadow: '0 0 8px var(--lcd-text)' }}>
                                    Capture a photo of your handwritten code
                                </p>
                                <button onClick={startCamera} className="btn btn-primary">
                                    📷 Start Camera
                                </button>
                            </div>
                        )}

                        {/* Error */}
                        {status === 'error' && (
                            <div className="card">
                                <h2 className="card-title" style={{ color: '#cc3333' }}>▶ Camera Error</h2>
                                <p style={{ marginBottom: '12px', fontSize: '12px', color: '#cc3333' }}>{cameraError}</p>
                                <button onClick={startCamera} className="btn btn-secondary">↻ Try Again</button>
                            </div>
                        )}

                        {/* Camera View */}
                        {showCamera && (
                            <>
                                <div className="video-wrapper">
                                    {capturedImage ? (
                                        <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                                    ) : (
                                        <>
                                            <video
                                                ref={videoRef}
                                                playsInline muted autoPlay
                                                onCanPlay={handleVideoCanPlay}
                                                onLoadedMetadata={handleVideoCanPlay}
                                                onPlaying={handleVideoCanPlay}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'initializing' ? 'none' : 'block' }}
                                            />
                                            {status === 'initializing' && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#000' }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <span className="spinner"></span>
                                                        <div style={{ fontFamily: 'var(--font-lcd)', fontSize: '14px', color: 'var(--lcd-text)', marginTop: '10px' }}>{statusText}</div>
                                                    </div>
                                                </div>
                                            )}
                                            {status !== 'initializing' && <div className="scan-overlay" />}
                                        </>
                                    )}
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </div>

                                <div className={`scan-status ${status === 'detected' ? 'detected' : ''}`}>
                                    {status === 'camera-ready' && !capturedImage && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                            <span>{statusText}</span>
                                            <button onClick={captureAndProcess} className="btn btn-primary" disabled={!isVideoReady}>
                                                {isVideoReady ? '📸 Capture & Scan' : '⏳ Loading...'}
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
                                            <div style={{ fontSize: '12px', color: 'var(--light-gray)' }}>Redirecting...</div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Manual Entry - Single editable input */}
                        <div className="card">
                            <h2 className="card-title">▶ Manual Entry</h2>
                            <p style={{ marginBottom: '12px', fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--light-gray)' }}>
                                Tap below and type the 6 characters:
                            </p>
                            <div style={{ position: 'relative' }}>
                                {/* Visible formatted display */}
                                <div
                                    onClick={() => inputRef.current?.focus()}
                                    style={{
                                        fontFamily: 'var(--font-lcd)',
                                        fontSize: '28px',
                                        color: 'var(--lcd-text)',
                                        textShadow: '0 0 10px var(--lcd-text)',
                                        textAlign: 'center',
                                        padding: '16px',
                                        background: 'linear-gradient(180deg, var(--lcd-bg-light) 0%, var(--lcd-bg-dark) 100%)',
                                        border: '2px solid var(--shadow-deep)',
                                        borderRadius: '4px',
                                        letterSpacing: '6px',
                                        cursor: 'text',
                                        minHeight: '70px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {getFormattedDisplay()}
                                </div>
                                {/* Hidden input for capturing keyboard */}
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value=""
                                    onChange={() => { }}
                                    onKeyDown={handleKeyDown}
                                    style={{
                                        position: 'absolute',
                                        opacity: 0,
                                        width: '100%',
                                        height: '100%',
                                        top: 0,
                                        left: 0,
                                        caretColor: 'transparent',
                                        cursor: 'default'
                                    }}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="characters"
                                />
                            </div>
                            <button
                                onClick={handleManualSubmit}
                                className="btn btn-primary"
                                disabled={manualCodeChars.length !== 6}
                                style={{ marginTop: '12px', width: '100%' }}
                            >
                                {manualCodeChars.length === 6 ? '▶ Go' : `${manualCodeChars.length}/6 characters`}
                            </button>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
