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

    const [flashOn, setFlashOn] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const workerRef = useRef<any>(null);

    const codePattern = /PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}/gi;
    const validChars = '23456789ACDEFGHJKLMNPQRTUVWXY';

    const toggleFlash = async () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        if (!track) return;

        try {
            await track.applyConstraints({
                advanced: [{ torch: !flashOn }] as any
            });
            setFlashOn(!flashOn);
        } catch (err) {
            console.error('Flash error:', err);
        }
    };

    const applyDigitalTheme = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to "Matrix/LCD" theme
        // Dark pixels -> Cyan (#00ffcc)
        // Light pixels -> Transparent/Background color logic handled by CSS or here
        // Actually, we want to replace ink with Cyan, and paper with Dark Blue

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            if (gray < 100) {
                // Ink (Dark) -> Neon Cyan
                data[i] = 0;    // R
                data[i + 1] = 255; // G
                data[i + 2] = 204; // B
                data[i + 3] = 255; // Alpha
            } else {
                // Paper (Light) -> Dark Blue (Background)
                data[i] = 31;   // R (#1f)
                data[i + 1] = 54; // G (#36)
                data[i + 2] = 153; // B (#99)
                data[i + 3] = 255; // Alpha
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

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
        const overlay = overlayRef.current;

        if (!video || !canvas || !workerRef.current || !overlay) {
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

            // Exact Crop Logic with Zoom/Mask support
            const videoRect = video.getBoundingClientRect();
            const overlayRect = overlay.getBoundingClientRect();

            // Calculate ratios to map visually displayed pixels to native video pixels
            // videoRect includes the CSS scale transform, so this logic remains robust
            const scaleX = video.videoWidth / videoRect.width;
            const scaleY = video.videoHeight / videoRect.height;

            const relativeCropX = overlayRect.left - videoRect.left;
            const relativeCropY = overlayRect.top - videoRect.top;

            const cropX = relativeCropX * scaleX;
            const cropY = relativeCropY * scaleY;
            const cropWidth = overlayRect.width * scaleX;
            const cropHeight = overlayRect.height * scaleY;

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            // Draw original for OCR
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            // 1. Process for OCR (Adaptive Threshold for Flash/Glare)
            const ocrImage = preprocessImage(canvas);

            // 2. Process for Display (Digitize Animation)
            // Redraw original to canvas to reset effects for display processing
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            applyDigitalTheme(ctx, cropWidth, cropHeight);
            const displayImage = canvas.toDataURL('image/png');

            setCapturedImage(displayImage);

            setStatus('processing');
            setStatusText('Analyzing...');

            // Run OCR on the high-contrast version
            const result = await workerRef.current.recognize(ocrImage);
            const text = result.data.text.toUpperCase();
            console.log('OCR Result:', text);

            const matches = text.match(codePattern);

            if (matches && matches.length > 0) {
                // Artificial delay to show off the "Digitize" animation
                setTimeout(() => {
                    handleCodeDetected(matches[0].toUpperCase());
                }, 800);
            } else {
                setStatusText('No code found. Try again.');
                setTimeout(() => {
                    resetToInitial();
                }, 2000);
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
            setFlashOn(false);

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 }, // Higher res for better crop
                    height: { ideal: 1080 }
                },
            });
            streamRef.current = stream;

            // Check for flash capability
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            setHasFlash('torch' in capabilities);

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

    // Advanced Adaptive Thresholding (Integral Image) for Flash/Glare handling
    const preprocessImage = (canvas: HTMLCanvasElement): string => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas.toDataURL('image/png');

        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const grayData = new Uint8Array(width * height);

        // 1. Convert to Grayscale
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            grayData[i] = (r * 299 + g * 587 + b * 114) / 1000;
        }

        // 2. Compute Integral Image for fast local mean calculation
        const integral = new Uint32Array(width * height);
        for (let y = 0; y < height; y++) {
            let sum = 0;
            for (let x = 0; x < width; x++) {
                sum += grayData[y * width + x];
                if (y === 0) {
                    integral[y * width + x] = sum;
                } else {
                    integral[y * width + x] = integral[(y - 1) * width + x] + sum;
                }
            }
        }

        // 3. Adaptive Thresholding
        const windowSize = 20; // Size of local neighborhood
        const C = 15; // Constant to subtract from mean (Sensitivity)
        const halfSize = Math.floor(windowSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate local mean
                const x1 = Math.max(0, x - halfSize);
                const y1 = Math.max(0, y - halfSize);
                const x2 = Math.min(width - 1, x + halfSize);
                const y2 = Math.min(height - 1, y + halfSize);

                const count = (x2 - x1 + 1) * (y2 - y1 + 1);

                const br = integral[y2 * width + x2];
                const tl = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * width + (x1 - 1)] : 0;
                const tr = (y1 > 0) ? integral[(y1 - 1) * width + x2] : 0;
                const bl = (x1 > 0) ? integral[y2 * width + (x1 - 1)] : 0;

                const sum = br - tr - bl + tl;
                const mean = sum / count;

                const val = grayData[y * width + x];
                const binary = val < (mean - C) ? 0 : 255; // Darker than local mean = Ink

                const idx = (y * width + x) * 4;
                data[idx] = binary;
                data[idx + 1] = binary;
                data[idx + 2] = binary;
            }
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
                        {status === 'idle' && (
                            <div className="card text-center" style={{ padding: '30px' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
                                <p style={{ marginBottom: '20px', fontFamily: 'var(--font-label)', fontSize: '13px', color: 'var(--btn-icon)', fontWeight: 'bold' }}>
                                    Capture a photo of your handwritten code
                                </p>
                                <button onClick={startCamera} className="btn btn-primary" style={{ width: '100%' }}>
                                    Start Camera
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

                        {/* Camera View - "Sniper" Masked View */}
                        {showCamera && (
                            <>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    marginBottom: '20px',
                                    position: 'relative',
                                    zIndex: 1,
                                    marginTop: '20px'
                                }}>
                                    {/* Mask Container - Only this part is visible */}
                                    <div
                                        ref={overlayRef}
                                        style={{
                                            width: '280px',
                                            height: '90px',
                                            border: '2px solid #00ffcc',
                                            position: 'relative',
                                            overflow: 'hidden', // MASKING THE REST
                                            borderRadius: '4px',
                                            boxShadow: '0 0 15px rgba(0, 255, 204, 0.3)',
                                            background: '#000'
                                        }}
                                    >
                                        {capturedImage ? (
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                background: '#1f3699',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                animation: 'fadeIn 0.5s ease-out'
                                            }}>
                                                <img
                                                    src={capturedImage}
                                                    alt="Digitized"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'fill', // Stretch to fit the box exactly
                                                        imageRendering: 'pixelated'
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {/* Video with Digital Zoom */}
                                                <video
                                                    ref={videoRef}
                                                    playsInline muted autoPlay
                                                    onCanPlay={handleVideoCanPlay}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        transform: 'scale(1.5)', // DIGITAL ZOOM
                                                        transformOrigin: 'center center'
                                                    }}
                                                />

                                                {/* Loading Spinner Over Video */}
                                                {status === 'initializing' && (
                                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
                                                        <span className="spinner"></span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Flash Toggle - Positioned relative to the mask */}
                                    {hasFlash && !capturedImage && (
                                        <button
                                            onClick={toggleFlash}
                                            style={{
                                                position: 'absolute',
                                                right: '0',
                                                top: '-40px', // Above the box
                                                background: flashOn ? '#ffcc00' : 'rgba(0,0,0,0.3)',
                                                border: '1px solid #fff',
                                                borderRadius: '4px',
                                                width: '32px',
                                                height: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>⚡️</span>
                                        </button>
                                    )}
                                </div>
                                {/* Instruction Text under box */}
                                <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '12px', color: '#b8c0cc' }}>
                                    {status === 'camera-ready' ? 'Center code in box & Capture' : statusText}
                                </div>

                                <div className={`scan-status ${status === 'detected' ? 'detected' : ''}`}>
                                    {status === 'camera-ready' && !capturedImage && (
                                        <button onClick={captureAndProcess} className="btn btn-primary" disabled={!isVideoReady} style={{ width: '200px', margin: '0 auto', display: 'block' }}>
                                            {isVideoReady ? '📸 Capture' : '⏳ Loading...'}
                                        </button>
                                    )}

                                    {status === 'detected' && (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '16px', marginBottom: '8px', color: '#00ffcc' }}>✅ {detectedCode}</div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

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
