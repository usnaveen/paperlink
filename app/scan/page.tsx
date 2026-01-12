'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import Image from 'next/image';

type ScanStatus = 'idle' | 'initializing' | 'camera-ready' | 'capturing' | 'processing' | 'detected' | 'not-found' | 'fuzzy-match' | 'error';
type CodeState = 'empty' | 'scanning' | 'found' | 'not-found' | 'fuzzy';

// Nav button themes - Bright backgrounds with white text
const GREEN_NAV = {
    bg: '#00aa00',
    bgDim: '#003300',
    textActive: '#ffffff',
    textInactive: '#88ff88',
    glow: '0 0 12px #00ff00'
};

const YELLOW_NAV = {
    bg: '#cc9900',
    bgDim: '#443300',
    textActive: '#ffffff',
    textInactive: '#ffdd88',
    glow: '0 0 12px #ffcc00'
};

export default function ScanPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [statusText, setStatusText] = useState('');
    const [detectedCode, setDetectedCode] = useState('');
    const [displayCode, setDisplayCode] = useState('');
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

    const LCD_THEME = {
        bg: '#0055aa',
        dotInactive: 'rgba(255, 255, 255, 0.15)',
        dotActive: '#ffffff',
        glow: '0 0 8px #ffffff, 0 0 2px #ffffff'
    };

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

    const animateCodeDisplay = async (code: string, finalState: CodeState) => {
        setIsAnimating(true);
        setDisplayCode(code); // Show code immediately
        const chars = 'ABCDEFGHJKLMNPQRTUVWXY23456789';

        // Faster animation - only 3 iterations, 25ms delay
        for (let pos = 0; pos < code.length; pos++) {
            const targetChar = code[pos];
            if (targetChar === '-' || targetChar === 'P' || targetChar === 'L') continue;

            for (let i = 0; i < 3; i++) {
                const randomChar = chars[Math.floor(Math.random() * chars.length)];
                const displayChars = code.split('');
                displayChars[pos] = randomChar;
                setDisplayCode(displayChars.join(''));
                await new Promise(r => setTimeout(r, 25));
            }
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
            await track.applyConstraints({ advanced: [{ torch: !flashOn }] as any });
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
                data[i] = 0; data[i + 1] = 255; data[i + 2] = 204; data[i + 3] = 255;
            } else {
                data[i] = 31; data[i + 1] = 54; data[i + 2] = 153; data[i + 3] = 255;
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
        setFlashOn(false);
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
        resetToInitial();
        return () => {
            stopCamera();
            if (workerRef.current) workerRef.current.terminate().catch(() => { });
        };
    }, [stopCamera, resetToInitial]);

    const handleCodeDetected = async (code: string, isFuzzyMatch = false, originalCode?: string) => {
        setDetectedCode(code);
        setManualCodeChars(code.replace(/PL-|-/g, ''));

        if (isFuzzyMatch && originalCode) {
            // Show original scanned code in RED first
            setDisplayCode(originalCode);
            setCodeState('not-found');
            await new Promise(r => setTimeout(r, 600));

            // Then animate to corrected code and turn YELLOW
            await animateCodeDisplay(code, 'fuzzy');
            setCodeState('fuzzy');
            await new Promise(r => setTimeout(r, 400));
        } else {
            // Regular scan - animate the code
            setCodeState('scanning');
            await animateCodeDisplay(code, 'scanning');
        }

        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);

        try {
            const response = await fetch(`/api/resolve/${encodeURIComponent(code)}`);
            const data = await response.json();

            if (response.ok && data.url) {
                // Found - turn GREEN
                setCodeState('found');
                setStatus('detected');
                await new Promise(r => setTimeout(r, 400));
                window.location.href = data.url;
            } else {
                // Not found - show code in RED
                setDisplayCode(code);
                setCodeState('not-found');
                setStatus('not-found');
                setTimeout(() => resetToInitial(), 2000);
            }
        } catch (err) {
            console.error('Resolve error:', err);
            setDisplayCode(code);
            setCodeState('not-found');
            setTimeout(() => resetToInitial(), 1500);
        }
    };

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
                if (diff === 1) return { match: dbCode, original: scannedCode };
            }
            return null;
        } catch { return null; }
    };

    const captureAndProcess = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;

        if (!video || !canvas || !workerRef.current || !overlay) return;
        if (!isVideoReady || video.videoWidth === 0 || video.videoHeight === 0) return;

        setStatus('capturing');
        setCodeState('scanning');

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            // Viewfinder is 280x90, video has scale(1.5)
            const containerWidth = overlay.clientWidth;  // 280
            const containerHeight = overlay.clientHeight; // 90
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

            // OCR preprocessing
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

            // Display image
            ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
            applyDigitalTheme(ctx, sourceW, sourceH);
            const displayImage = canvas.toDataURL('image/png');

            setCapturedImage(displayImage);
            setStatus('processing');

            const result = await workerRef.current.recognize(ocrImage);
            const text = result.data.text.toUpperCase();
            const cleanText = text.replace(/[^A-Z0-9-]/g, '');
            const matches = cleanText.match(codePattern);

            if (matches && matches.length > 0) {
                const scannedCode = matches[0].toUpperCase();
                const exactResponse = await fetch(`/api/resolve/${encodeURIComponent(scannedCode)}`);
                if (exactResponse.ok) {
                    handleCodeDetected(scannedCode);
                } else {
                    const fuzzy = await findFuzzyMatch(scannedCode);
                    if (fuzzy) handleCodeDetected(fuzzy.match, true, fuzzy.original);
                    else handleCodeDetected(scannedCode);
                }
            } else {
                setCodeState('not-found');
                setTimeout(() => resetToInitial(), 2000);
            }
        } catch (err) {
            console.error('Capture error:', err);
            setCodeState('not-found');
            setTimeout(() => resetToInitial(), 1500);
        }
    };

    const handleVideoCanPlay = () => setIsVideoReady(true);

    const startCamera = async () => {
        try {
            setStatus('initializing');
            setCameraError('');
            setCapturedImage(null);
            setIsVideoReady(false);
            setFlashOn(false);
            setCodeState('empty');

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera not supported');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
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
                const { default: Tesseract, PSM } = await import('tesseract.js');
                const worker = await Tesseract.createWorker('eng', 1);
                await worker.setParameters({
                    tessedit_char_whitelist: 'PLABCDEFGHJKLMNQRTUVWXY23456789-',
                    tessedit_pageseg_mode: PSM.SINGLE_LINE,
                });
                workerRef.current = worker;
            }

            setStatus('camera-ready');
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
            const gray = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
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
                integral[y * width + x] = y === 0 ? sum : integral[(y - 1) * width + x] + sum;
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
        if (e.key === 'Backspace') { setManualCodeChars(prev => prev.slice(0, -1)); e.preventDefault(); return; }
        if (e.key === 'Enter' && manualCodeChars.length === 6) { handleManualSubmit(); e.preventDefault(); return; }
        if (validChars.includes(key) && manualCodeChars.length < 6) { setManualCodeChars(prev => prev + key); e.preventDefault(); }
    };

    const handleManualSubmit = async () => {
        if (manualCodeChars.length !== 6) return;
        const fullCode = `PL-${manualCodeChars.slice(0, 3)}-${manualCodeChars.slice(3, 6)}`;
        await handleCodeDetected(fullCode);
    };

    const getFormattedDisplay = () => {
        if (displayCode) return displayCode;
        const chars = manualCodeChars.padEnd(6, '_');
        return `PL-${chars.slice(0, 3)}-${chars.slice(3, 6)}`;
    };

    const showCamera = status !== 'idle' && status !== 'error';
    const cameraActive = showCamera && isVideoReady;
    const theme = getCodeTheme(codeState);

    const DotMatrixDisplay = ({ text, bgColor, textColor, glow, fontSize = '16px', bold = false }: {
        text: string, bgColor: string, textColor: string, glow: string, fontSize?: string, bold?: boolean
    }) => (
        <div style={{
            background: bgColor,
            borderRadius: '6px',
            border: '3px solid rgba(0,0,0,0.4)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
            padding: '16px 20px',
            margin: '6px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `radial-gradient(circle, ${textColor}22 1px, transparent 1px)`,
                backgroundSize: '4px 4px', opacity: 0.8
            }} />
            <div style={{
                position: 'relative',
                fontFamily: '"Doto", monospace',
                fontSize: fontSize,
                fontWeight: bold ? 900 : 700,
                color: textColor,
                textShadow: glow,
                textAlign: 'center',
                letterSpacing: '2px',
                whiteSpace: 'nowrap'
            }}>{text}</div>
        </div>
    );

    // Matrix Nav Button - Consistent Box Style
    const MatrixNavButton = ({ href, label, navTheme, isActive }: {
        href: string, label: string, navTheme: typeof GREEN_NAV, isActive: boolean
    }) => (
        <Link href={href} style={{
            flex: 1,
            background: isActive ? navTheme.bg : navTheme.bgDim,
            borderRadius: '6px',
            border: '3px solid rgba(0,0,0,0.4)',
            boxShadow: isActive
                ? `inset 0 2px 8px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.1), 0 0 15px ${navTheme.bg}80`
                : 'inset 0 2px 8px rgba(0,0,0,0.6)',
            padding: '14px 20px',
            position: 'relative',
            overflow: 'hidden',
            textDecoration: 'none',
            display: 'block',
            textAlign: 'center'
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `radial-gradient(circle, ${isActive ? navTheme.textActive : navTheme.textInactive} 1px, transparent 1px)`,
                backgroundSize: '4px 4px',
                opacity: isActive ? 0.3 : 0.1
            }} />
            <div style={{
                position: 'relative',
                fontFamily: '"Doto", monospace',
                fontSize: '14px',
                fontWeight: 900,
                color: isActive ? navTheme.textActive : navTheme.textInactive,
                textShadow: isActive ? navTheme.glow : 'none',
                letterSpacing: '2px',
                textTransform: 'uppercase'
            }}>{label}</div>
        </Link>
    );

    return (
        <div className="container">
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .led-on { animation: pulse 1s ease-in-out infinite; }
            `}</style>

            <div className="winamp-window">
                <div className="winamp-titlebar">
                    <span className="winamp-titlebar-text">PAPERLINK SCANNER</span>
                    <AuthButton />
                </div>

                <div className="winamp-content">
                    <DotMatrixDisplay
                        text="SCAN YOUR HANDWRITTEN CODES"
                        bgColor={LCD_THEME.bg}
                        textColor={LCD_THEME.dotActive}
                        glow={LCD_THEME.glow}
                        fontSize="14px"
                        bold={true}
                    />

                    <main className="scanner-container">
                        <div className="card">
                            <h2 className="card-title">▶ Camera</h2>

                            {/* Viewfinder - Fixed 280x90 */}
                            <div
                                ref={overlayRef}
                                style={{
                                    width: '280px',
                                    height: '90px',
                                    margin: '0 auto',
                                    border: '2px solid #00ffcc',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderRadius: '4px',
                                    boxShadow: cameraActive ? '0 0 15px rgba(0, 255, 204, 0.3)' : 'none',
                                    background: '#0a1a2e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {status === 'idle' && (
                                    <span style={{ color: '#00ffcc', fontSize: '11px', textAlign: 'center', padding: '10px', opacity: 0.7 }}>
                                        Point camera at handwritten code
                                    </span>
                                )}

                                {status === 'error' && (
                                    <span style={{ color: '#ff3333', fontSize: '11px', textAlign: 'center', padding: '10px' }}>{cameraError}</span>
                                )}

                                {showCamera && !capturedImage && (
                                    <>
                                        <video
                                            ref={videoRef}
                                            playsInline muted autoPlay
                                            onCanPlay={handleVideoCanPlay}
                                            style={{
                                                width: '100%', height: '100%',
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

                                {capturedImage && (
                                    <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'fill', imageRendering: 'pixelated' }} />
                                )}
                            </div>

                            {/* Camera Controls - LEDs on left of camera button */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                                {/* LED Indicators */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: cameraActive ? '#00ff00' : '#333',
                                            boxShadow: cameraActive ? '0 0 6px #00ff00' : 'none',
                                            border: '1px solid #555'
                                        }} className={cameraActive ? 'led-on' : ''} />
                                        <span style={{ fontSize: '9px', color: '#777' }}>CAM</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: flashOn ? '#ffcc00' : '#333',
                                            boxShadow: flashOn ? '0 0 6px #ffcc00' : 'none',
                                            border: '1px solid #555'
                                        }} className={flashOn ? 'led-on' : ''} />
                                        <span style={{ fontSize: '9px', color: '#777' }}>FLS</span>
                                    </div>
                                </div>

                                {/* Camera Button */}
                                <button
                                    onClick={showCamera ? captureAndProcess : startCamera}
                                    disabled={showCamera && !isVideoReady}
                                    style={{
                                        background: (showCamera && !isVideoReady) ? '#666' : 'linear-gradient(180deg, #e8e8e8 0%, #c8c8c8 100%)',
                                        border: '1px solid #999',
                                        borderRadius: '30px',
                                        padding: '10px 36px',
                                        cursor: (showCamera && !isVideoReady) ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8)'
                                    }}
                                >
                                    <Image src="/camera.svg" alt="Camera" width={22} height={22} style={{ opacity: (showCamera && !isVideoReady) ? 0.3 : 0.7 }} />
                                </button>

                                {/* Flash Button */}
                                {hasFlash && (
                                    <button
                                        onClick={toggleFlash}
                                        style={{
                                            background: flashOn ? 'linear-gradient(180deg, #ffee00 0%, #ffcc00 100%)' : 'linear-gradient(180deg, #555 0%, #333 100%)',
                                            border: '1px solid #666',
                                            borderRadius: '50%',
                                            width: '36px',
                                            height: '36px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Image src="/flash.png" alt="Flash" width={18} height={18} style={{ opacity: flashOn ? 1 : 0.5 }} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Code Display */}
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
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
                                    }}>{getFormattedDisplay()}</div>
                                </div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value=""
                                    onChange={() => { }}
                                    onKeyDown={handleKeyDown}
                                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0 }}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="characters"
                                    disabled={isAnimating}
                                />
                            </div>
                            <p style={{ marginTop: '8px', fontSize: '11px', color: '#888', textAlign: 'center' }}>
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

                        {/* Matrix Navigation */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', margin: '12px 6px 0 6px' }}>
                            <MatrixNavButton href="/" label="Write" navTheme={GREEN_NAV} isActive={false} />
                            <MatrixNavButton href="/scan" label="Scan" navTheme={YELLOW_NAV} isActive={true} />
                        </div>
                    </main>
                </div>
            </div>
            <div style={{ textAlign: 'center', padding: '8px', fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>v0.3.1</div>
        </div>
    );
}
