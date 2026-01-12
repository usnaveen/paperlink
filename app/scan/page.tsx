'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import Image from 'next/image';

type ScanStatus = 'idle' | 'initializing' | 'camera-ready' | 'capturing' | 'processing' | 'detected' | 'not-found' | 'fuzzy-match' | 'error';
type CodeState = 'empty' | 'scanning' | 'found' | 'not-found' | 'fuzzy';

export default function ScanPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [detectedCode, setDetectedCode] = useState('');
    const [displayCode, setDisplayCode] = useState(''); // For animation
    const [codeState, setCodeState] = useState<CodeState>('empty');
    const [manualCodeChars, setManualCodeChars] = useState('');
    const [cameraError, setCameraError] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const [flashOn, setFlashOn] = useState(false);
    const [hasFlash, setHasFlash] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const workerRef = useRef<any>(null);

    const codePattern = /PL-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}-[23456789ACDEFGHJKLMNPQRTUVWXY]{3}/gi;
    const validChars = '23456789ACDEFGHJKLMNPQRTUVWXY';

    // Theme Constants
    const LCD_THEME = {
        bg: '#0055aa',
        dotInactive: 'rgba(255, 255, 255, 0.15)',
        dotActive: '#ffffff',
        glow: '0 0 8px #ffffff, 0 0 2px #ffffff'
    };

    // Color themes for code states
    const getCodeTheme = (state: CodeState) => {
        switch (state) {
            case 'found':
                return { bg: '#001100', dotActive: '#00ff00', glow: '0 0 12px #00ff00' };
            case 'not-found':
                return { bg: '#110000', dotActive: '#ff3333', glow: '0 0 12px #ff3333' };
            case 'fuzzy':
                return { bg: '#111100', dotActive: '#ffcc00', glow: '0 0 12px #ffcc00' };
            default:
                return { bg: '#0a1a2e', dotActive: '#00ffcc', glow: '0 0 8px #00ffcc' };
        }
    };

    // Rotary animation for code display
    const animateCodeDisplay = async (code: string, finalState: CodeState) => {
        setIsAnimating(true);
        const chars = 'ABCDEFGHJKLMNPQRTUVWXY23456789';

        // Roll each character
        for (let pos = 0; pos < code.length; pos++) {
            const targetChar = code[pos];
            if (targetChar === '-' || targetChar === 'P' || targetChar === 'L') {
                // Skip dashes and PL prefix
                continue;
            }

            // Roll through random chars
            for (let i = 0; i < 5; i++) {
                const randomChar = chars[Math.floor(Math.random() * chars.length)];
                const displayChars = code.split('');
                displayChars[pos] = randomChar;
                setDisplayCode(displayChars.join(''));
                await new Promise(r => setTimeout(r, 50));
            }

            // Land on final char
            setDisplayCode(code.slice(0, pos + 1) + code.slice(pos + 1));
        }

        setDisplayCode(code);
        setCodeState(finalState);
        setIsAnimating(false);
    };

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

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            if (gray < 100) {
                data[i] = 0;
                data[i + 1] = 255;
                data[i + 2] = 204;
                data[i + 3] = 255;
            } else {
                data[i] = 31;
                data[i + 1] = 54;
                data[i + 2] = 153;
                data[i + 3] = 255;
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

    const resetToInitial = useCallback(() => {
        stopCamera();
        setCapturedImage(null);
        setStatus('idle');
        setStatusText('');
        setCameraError('');
        setDetectedCode('');
        setDisplayCode('');
        setCodeState('empty');
        setManualCodeChars('');
    }, [stopCamera]);

    useEffect(() => {
        return () => {
            stopCamera();
            if (workerRef.current) {
                workerRef.current.terminate().catch(() => { });
            }
        };
    }, [stopCamera]);

    // Handle detected code with color states
    const handleCodeDetected = async (code: string, isFuzzyMatch = false, originalCode?: string) => {
        setDetectedCode(code);
        setManualCodeChars(code.replace(/PL-|-/g, '')); // Sync manual entry

        if (isFuzzyMatch && originalCode) {
            // Show original scanned code in RED first
            setDisplayCode(originalCode);
            setCodeState('not-found');
            await new Promise(r => setTimeout(r, 800));

            // Animate to corrected code, turn YELLOW
            await animateCodeDisplay(code, 'fuzzy');
            await new Promise(r => setTimeout(r, 500));
        } else {
            // Animate the code rolling in
            setCodeState('scanning');
            await animateCodeDisplay(code, 'scanning');
        }

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        try {
            const response = await fetch(`/api/resolve/${encodeURIComponent(code)}`);
            const data = await response.json();

            if (response.ok && data.url) {
                setCodeState('found');
                setStatus('detected');
                setStatusText('Opening link...');
                await new Promise(r => setTimeout(r, 600));
                window.location.href = data.url;
            } else {
                setCodeState('not-found');
                setStatus('not-found');
                setStatusText(`Code "${code}" not found.`);
                setTimeout(() => resetToInitial(), 2000);
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setCodeState('not-found');
            setStatusText('Error looking up code.');
            setTimeout(() => resetToInitial(), 1500);
        }
    };

    // Fuzzy match helper
    const findFuzzyMatch = async (scannedCode: string): Promise<{ match: string, original: string } | null> => {
        try {
            const response = await fetch('/api/codes');
            const data = await response.json();
            if (!data.codes) return null;

            const codes: string[] = data.codes;
            const scannedChars = scannedCode.replace(/PL-|-/g, '');

            for (const dbCode of codes) {
                const dbChars = dbCode.replace(/PL-|-/g, '');
                let diff = 0;
                for (let i = 0; i < 6; i++) {
                    if (scannedChars[i] !== dbChars[i]) diff++;
                }
                if (diff === 1) {
                    return { match: dbCode, original: scannedCode };
                }
            }
            return null;
        } catch {
            return null;
        }
    };

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
        setCodeState('scanning');

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const containerWidth = overlay.clientWidth;
            const containerHeight = overlay.clientHeight;
            const cssScale = 1.5;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const videoRatio = videoWidth / videoHeight;
            const containerRatio = containerWidth / containerHeight;

            let fittedWidth, fittedHeight;
            if (videoRatio > containerRatio) {
                fittedHeight = containerHeight;
                fittedWidth = containerHeight * videoRatio;
            } else {
                fittedWidth = containerWidth;
                fittedHeight = containerWidth / videoRatio;
            }

            const scaledWidth = fittedWidth * cssScale;
            const scaledHeight = fittedHeight * cssScale;
            const visibleLeft = (scaledWidth - containerWidth) / 2;
            const visibleTop = (scaledHeight - containerHeight) / 2;
            const sourceScale = videoWidth / scaledWidth;
            const sourceX = visibleLeft * sourceScale;
            const sourceY = visibleTop * sourceScale;
            const sourceW = containerWidth * sourceScale;
            const sourceH = containerHeight * sourceScale;

            canvas.width = sourceW;
            canvas.height = sourceH;
            ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);

            const ocrCanvas = document.createElement('canvas');
            const ocrHeight = 60;
            const ocrWidth = sourceW * (ocrHeight / sourceH);
            ocrCanvas.width = ocrWidth + 40;
            ocrCanvas.height = ocrHeight + 40;
            const ocrCtx = ocrCanvas.getContext('2d');

            if (ocrCtx) {
                ocrCtx.fillStyle = '#FFFFFF';
                ocrCtx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);
                ocrCtx.drawImage(canvas, 0, 0, sourceW, sourceH, 20, 20, ocrWidth, ocrHeight);
            }

            const ocrImage = preprocessImage(ocrCanvas.width > 0 ? ocrCanvas : canvas);

            ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
            applyDigitalTheme(ctx, sourceW, sourceH);
            const displayImage = canvas.toDataURL('image/png');

            setCapturedImage(displayImage);

            setStatus('processing');
            setStatusText('Analyzing...');

            const result = await workerRef.current.recognize(ocrImage);
            const text = result.data.text.toUpperCase();
            const cleanText = text.replace(/[^A-Z0-9-]/g, '');
            const matches = cleanText.match(codePattern);

            if (matches && matches.length > 0) {
                const scannedCode = matches[0].toUpperCase();

                // First try exact match
                const exactResponse = await fetch(`/api/resolve/${encodeURIComponent(scannedCode)}`);
                if (exactResponse.ok) {
                    handleCodeDetected(scannedCode);
                } else {
                    // Try fuzzy match
                    const fuzzy = await findFuzzyMatch(scannedCode);
                    if (fuzzy) {
                        handleCodeDetected(fuzzy.match, true, fuzzy.original);
                    } else {
                        handleCodeDetected(scannedCode);
                    }
                }
            } else {
                setCodeState('not-found');
                setStatusText('No code found. Try again.');
                setTimeout(() => resetToInitial(), 2000);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setCodeState('not-found');
            setStatusText('Error. Try again.');
            setTimeout(() => resetToInitial(), 1500);
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
            setCodeState('empty');

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera not supported');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
            });
            streamRef.current = stream;

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

        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const grayData = new Uint8Array(width * height);

        let min = 255, max = 0;
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const gray = (r * 299 + g * 587 + b * 114) / 1000;
            grayData[i] = gray;
            if (gray < min) min = gray;
            if (gray > max) max = gray;
        }

        if (max > min) {
            for (let i = 0; i < width * height; i++) {
                grayData[i] = ((grayData[i] - min) / (max - min)) * 255;
            }
        }

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

        const windowSize = Math.max(10, Math.floor(width / 20));
        const C = 10;
        const halfSize = Math.floor(windowSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
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
                const binary = grayData[y * width + x] < (mean - C) ? 0 : 255;

                const idx = (y * width + x) * 4;
                data[idx] = binary;
                data[idx + 1] = binary;
                data[idx + 2] = binary;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
    };

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

    const getFormattedDisplay = () => {
        // If we have a detected/display code, show that
        if (displayCode) return displayCode;
        // Otherwise show manual entry
        const chars = manualCodeChars.padEnd(6, '_');
        return `PL-${chars.slice(0, 3)}-${chars.slice(3, 6)}`;
    };

    const showCamera = status !== 'idle' && status !== 'error';
    const cameraActive = showCamera && isVideoReady;
    const theme = getCodeTheme(codeState);

    // Functional Dot Matrix Display Component
    const DotMatrixDisplay = ({ text, bgColor, textColor, glow, fontSize = '16px' }: {
        text: string, bgColor: string, textColor: string, glow: string, fontSize?: string
    }) => (
        <div style={{
            background: bgColor,
            borderRadius: '6px',
            border: '3px solid rgba(0,0,0,0.4)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
            padding: '16px 20px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `radial-gradient(circle, ${textColor}22 1px, transparent 1px)`,
                backgroundSize: '4px 4px',
                opacity: 0.8
            }} />
            <div style={{
                position: 'relative',
                fontFamily: '"Doto", monospace',
                fontSize: fontSize,
                fontWeight: 900,
                color: textColor,
                textShadow: glow,
                textAlign: 'center',
                letterSpacing: '2px',
                whiteSpace: 'nowrap'
            }}>
                {text}
            </div>
        </div>
    );

    return (
        <div className="container">
            {/* CSS Animations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .led-on { animation: pulse 1s ease-in-out infinite; }
            `}</style>

            <div className="winamp-window">
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">PAPERLINK SCANNER</span>
                    <AuthButton />
                </div>

                <div className="winamp-content">
                    {/* Dot Matrix Header */}
                    <DotMatrixDisplay
                        text="SCAN YOUR HANDWRITTEN CODES"
                        bgColor={LCD_THEME.bg}
                        textColor={LCD_THEME.dotActive}
                        glow={LCD_THEME.glow}
                        fontSize="14px"
                    />

                    <main className="scanner-container">
                        {/* Idle State - Pill Camera Button */}
                        {status === 'idle' && (
                            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                                <p style={{ marginBottom: '24px', fontFamily: 'var(--font-label)', fontSize: '13px', color: '#b8c0cc' }}>
                                    Point your camera at a handwritten code
                                </p>
                                {/* Pill-shaped Camera Button */}
                                <button
                                    onClick={startCamera}
                                    style={{
                                        background: 'linear-gradient(180deg, #e8e8e8 0%, #c8c8c8 100%)',
                                        border: '1px solid #999',
                                        borderRadius: '30px',
                                        padding: '14px 50px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)'
                                    }}
                                >
                                    <Image
                                        src="/camera.svg"
                                        alt="Camera"
                                        width={28}
                                        height={28}
                                        style={{ opacity: 0.7 }}
                                    />
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
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    marginBottom: '12px',
                                    position: 'relative',
                                    marginTop: '20px'
                                }}>
                                    {/* Viewfinder */}
                                    <div
                                        ref={overlayRef}
                                        style={{
                                            width: '280px',
                                            height: '90px',
                                            border: '2px solid #00ffcc',
                                            position: 'relative',
                                            overflow: 'hidden',
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
                                                justifyContent: 'center'
                                            }}>
                                                <img
                                                    src={capturedImage}
                                                    alt="Digitized"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'fill',
                                                        imageRendering: 'pixelated'
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <video
                                                    ref={videoRef}
                                                    playsInline muted autoPlay
                                                    onCanPlay={handleVideoCanPlay}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        transform: 'scale(1.5)',
                                                        transformOrigin: 'center center'
                                                    }}
                                                />
                                                {status === 'initializing' && (
                                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
                                                        <span className="spinner"></span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Status Text */}
                                <div style={{ textAlign: 'center', marginBottom: '16px', fontSize: '12px', color: '#b8c0cc' }}>
                                    {status === 'camera-ready' && !capturedImage ? 'Center code in box' : statusText}
                                </div>

                                {/* Camera Controls Row */}
                                {status === 'camera-ready' && !capturedImage && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '16px',
                                        marginBottom: '20px'
                                    }}>
                                        {/* LED Indicators */}
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {/* Camera LED */}
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: cameraActive ? '#00ff00' : '#333',
                                                boxShadow: cameraActive ? '0 0 8px #00ff00' : 'none'
                                            }} className={cameraActive ? 'led-on' : ''} />

                                            {/* Flash LED */}
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: flashOn ? '#ffcc00' : '#333',
                                                boxShadow: flashOn ? '0 0 8px #ffcc00' : 'none'
                                            }} className={flashOn ? 'led-on' : ''} />
                                        </div>

                                        {/* Capture Button (Pill) */}
                                        <button
                                            onClick={captureAndProcess}
                                            disabled={!isVideoReady}
                                            style={{
                                                background: isVideoReady
                                                    ? 'linear-gradient(180deg, #e8e8e8 0%, #c8c8c8 100%)'
                                                    : '#666',
                                                border: '1px solid #999',
                                                borderRadius: '30px',
                                                padding: '12px 40px',
                                                cursor: isVideoReady ? 'pointer' : 'not-allowed',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)'
                                            }}
                                        >
                                            <Image
                                                src="/camera.svg"
                                                alt="Capture"
                                                width={24}
                                                height={24}
                                                style={{ opacity: isVideoReady ? 0.7 : 0.3 }}
                                            />
                                        </button>

                                        {/* Flash Button */}
                                        {hasFlash && (
                                            <button
                                                onClick={toggleFlash}
                                                style={{
                                                    background: flashOn
                                                        ? 'linear-gradient(180deg, #ffee00 0%, #ffcc00 100%)'
                                                        : 'linear-gradient(180deg, #555 0%, #333 100%)',
                                                    border: '1px solid #666',
                                                    borderRadius: '50%',
                                                    width: '40px',
                                                    height: '40px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Image
                                                    src="/flash.png"
                                                    alt="Flash"
                                                    width={20}
                                                    height={20}
                                                    style={{ opacity: flashOn ? 1 : 0.5 }}
                                                />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Detected State */}
                                {(status === 'detected' || status === 'not-found' || status === 'fuzzy-match') && (
                                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '14px',
                                            color: codeState === 'found' ? '#00ff00' : codeState === 'fuzzy' ? '#ffcc00' : '#ff3333'
                                        }}>
                                            {codeState === 'found' && '✅ Opening link...'}
                                            {codeState === 'not-found' && '❌ Code not found'}
                                            {codeState === 'fuzzy' && '⚠️ Fuzzy match found'}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Manual Entry with Dynamic Color */}
                        <div className="card">
                            <h2 className="card-title">▶ Code Display</h2>
                            <div style={{ position: 'relative' }}>
                                <div
                                    onClick={() => inputRef.current?.focus()}
                                    style={{
                                        background: theme.bg,
                                        borderRadius: '6px',
                                        border: '3px solid rgba(0,0,0,0.4)',
                                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                                        padding: '20px',
                                        cursor: 'text',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        transition: 'background 0.3s ease'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundImage: `radial-gradient(circle, ${theme.dotActive}22 1px, transparent 1px)`,
                                        backgroundSize: '4px 4px'
                                    }} />
                                    <div style={{
                                        position: 'relative',
                                        fontFamily: '"Doto", monospace',
                                        fontSize: '32px',
                                        fontWeight: 900,
                                        color: theme.dotActive,
                                        textShadow: theme.glow,
                                        textAlign: 'center',
                                        letterSpacing: '4px',
                                        transition: 'color 0.3s ease'
                                    }}>
                                        {getFormattedDisplay()}
                                    </div>
                                </div>
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
                                        left: 0
                                    }}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="characters"
                                    disabled={isAnimating}
                                />
                            </div>
                            <p style={{
                                marginTop: '8px',
                                fontSize: '11px',
                                color: '#888',
                                textAlign: 'center'
                            }}>
                                {isAnimating ? 'Processing...' : 'Tap above to type manually'}
                            </p>
                            <button
                                onClick={handleManualSubmit}
                                className="btn btn-primary"
                                disabled={manualCodeChars.length !== 6 || isAnimating}
                                style={{ marginTop: '12px', width: '100%' }}
                            >
                                {manualCodeChars.length === 6 ? '▶ Go' : `${manualCodeChars.length}/6 characters`}
                            </button>
                        </div>

                        {/* Navigation */}
                        <nav className="nav-tabs" style={{ marginTop: '12px' }}>
                            <Link href="/" className="nav-tab">Write</Link>
                            <Link href="/scan" className="nav-tab active">Scan</Link>
                        </nav>
                    </main>
                </div>
            </div>
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
