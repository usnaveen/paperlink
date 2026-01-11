'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type ScanStatus = 'idle' | 'camera-ready' | 'capturing' | 'processing' | 'detected' | 'error';

export default function ScanPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [detectedCode, setDetectedCode] = useState('');
    const [manualCode, setManualCode] = useState('');
    const [cameraError, setCameraError] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const workerRef = useRef<any>(null);

    const codePattern = /PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}/gi;

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
            if (workerRef.current) {
                workerRef.current.terminate().catch(() => { });
            }
        };
    }, []);

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
        if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

        setStatus('capturing');
        setStatusText('Capturing...');

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (video.videoWidth === 0 || video.videoHeight === 0) {
                setStatusText('Camera not ready. Try again.');
                setStatus('camera-ready');
                return;
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
                cropX, cropY, cropWidth, cropHeight,  // Source (crop area)
                0, 0, cropWidth, cropHeight            // Destination (full canvas)
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
                // Keep the captured image visible for a moment
                setTimeout(() => setCapturedImage(null), 2000);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setStatusText('Error processing image. Try again.');
            setStatus('camera-ready');
            setCapturedImage(null);
        }
    };

    // Start camera
    const startCamera = async () => {
        try {
            setStatus('idle');
            setStatusText('Requesting camera access...');
            setCameraError('');
            setCapturedImage(null);

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

            // Initialize OCR worker
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

    // Handle manual code entry
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualCode.trim()) return;

        const code = manualCode.toUpperCase().trim();
        await handleCodeDetected(code);
    };

    // Retake photo
    const retakePhoto = () => {
        setCapturedImage(null);
        setStatus('camera-ready');
        setStatusText('Position code in the rectangle, then tap Capture');
    };

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
                        {/* Idle State */}
                        {status === 'idle' && !streamRef.current && (
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
                        {cameraError && (
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

                        {/* Camera View or Captured Image */}
                        {(status !== 'idle' || streamRef.current) && !cameraError && (
                            <>
                                <div className="video-wrapper">
                                    {/* Show captured image when available, otherwise show video */}
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
                                            <video ref={videoRef} playsInline muted autoPlay />
                                            <div className="scan-overlay" />
                                        </>
                                    )}
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                </div>

                                {/* Status Display */}
                                <div className={`scan-status ${status === 'detected' ? 'detected' : ''}`}>
                                    {status === 'camera-ready' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                            <span>{statusText}</span>
                                            <button
                                                onClick={captureAndProcess}
                                                className="btn btn-primary"
                                                style={{ marginTop: '8px' }}
                                            >
                                                📸 Capture & Scan
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

                                {/* Retake button when image is captured but no code found */}
                                {capturedImage && status === 'camera-ready' && (
                                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                                        <button onClick={retakePhoto} className="btn btn-secondary">
                                            ↻ Retake Photo
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Manual Entry */}
                        <div className="card">
                            <h2 className="card-title">▶ Manual Entry</h2>
                            <p style={{
                                marginBottom: '12px',
                                fontFamily: 'var(--font-label)',
                                fontSize: '11px',
                                color: 'var(--light-gray)'
                            }}>
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
                                        style={{ textTransform: 'uppercase', letterSpacing: '3px' }}
                                    />
                                    <button type="submit" className="btn btn-secondary">
                                        ▶ Go
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
