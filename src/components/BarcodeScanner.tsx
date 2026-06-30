import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, CameraOff, ChevronDown, Scan } from 'lucide-react';
import { Product } from '../types';
import { BarcodeScannerSettings, useBarcodeScanner, playBeep } from '../hooks/useBarcodeScanner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BarcodeScannerProps {
  products: Product[];
  onProductFound: (product: Product) => void;
  onProductNotFound: (barcode: string) => void;
  onMultipleFound: (barcode: string) => void;
  onClose: () => void;
  continuousMode?: boolean;
  settings: BarcodeScannerSettings;
  language?: string;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

// ─── HID Scanner Listener ────────────────────────────────────────────────────

interface HIDScannerListenerProps {
  enabled: boolean;
  onScan: (barcode: string) => void;
}

export function HIDScannerListener({ enabled, onScan }: HIDScannerListenerProps) {
  const bufferRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier-only keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        if (code.length >= 3) {
          onScan(code);
        }
        bufferRef.current = '';
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }

      // Single printable character
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        // Reset buffer after 100ms of inactivity (handles slow scanners)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
      bufferRef.current = '';
    };
  }, [enabled, onScan]);

  return null;
}

// ─── Main BarcodeScanner Component ───────────────────────────────────────────

export function BarcodeScanner({
  products,
  onProductFound,
  onProductNotFound,
  onMultipleFound,
  onClose,
  continuousMode = false,
  settings,
  language = 'ar',
}: BarcodeScannerProps) {
  const isRTL = language === 'ar';

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);
  const isUnmountedRef = useRef(false);

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    isRTL ? 'وجه الكاميرا إلى الباركود' : 'Point the camera at the barcode'
  );
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false);

  // Confirmation buffer: barcode must be read N times before accepted
  const CONFIRM_NEEDED = 3;
  const confirmCountRef = useRef<Map<string, number>>(new Map());
  const lastCodeRef = useRef<string>('');

  const { processScannedBarcode } = useBarcodeScanner();

  // ── Stop Camera ─────────────────────────────────────────────────────────

  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
        scannerRef.current = null;
      }
    } catch { /* ignore */ }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (!isUnmountedRef.current) {
      setCameraActive(false);
    }
  }, []);

  // ── Handle Scan Result ────────────────────────────────────────────────────

  const handleRawScan = useCallback(
    (rawCode: string) => {
      if (isUnmountedRef.current) return;
      const trimmed = rawCode.trim();
      if (!trimmed) return;

      // Confirmation logic
      if (trimmed !== lastCodeRef.current) {
        confirmCountRef.current.clear();
        lastCodeRef.current = trimmed;
      }

      const count = (confirmCountRef.current.get(trimmed) || 0) + 1;
      confirmCountRef.current.set(trimmed, count);

      if (count < CONFIRM_NEEDED) return;

      // Confirmed!
      confirmCountRef.current.clear();
      lastCodeRef.current = '';
      setLastScannedBarcode(trimmed);

      // Lookup product
      const matches = products.filter(
        (p) => p.barcode && p.barcode.trim() === trimmed
      );

      if (matches.length === 1) {
        setStatusMessage(
          isRTL
            ? `✅ تم العثور على: ${matches[0].name}`
            : `✅ Found: ${matches[0].name}`
        );
        setStatusType('success');
        if (settings.play_sound_on_success) playBeep('success');
        onProductFound(matches[0]);

        if (!continuousMode) {
          stopCamera().then(onClose);
        } else {
          // Reset status after 1.5s for next scan
          setTimeout(() => {
            if (!isUnmountedRef.current) {
              setStatusMessage(
                isRTL ? 'وجه الكاميرا إلى الباركود' : 'Point the camera at the barcode'
              );
              setStatusType('idle');
            }
          }, 1500);
        }
      } else if (matches.length === 0) {
        setStatusMessage(
          isRTL
            ? `❌ الباركود غير مسجل بالنظام: ${trimmed}`
            : `❌ Barcode not found: ${trimmed}`
        );
        setStatusType('error');
        playBeep('error');
        onProductNotFound(trimmed);
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            setStatusMessage(
              isRTL ? 'وجه الكاميرا إلى الباركود' : 'Point the camera at the barcode'
            );
            setStatusType('idle');
          }
        }, 2000);
      } else {
        setStatusMessage(
          isRTL
            ? `⚠️ يوجد أكثر من صنف بنفس الباركود: ${trimmed}`
            : `⚠️ Multiple products with barcode: ${trimmed}`
        );
        setStatusType('error');
        playBeep('error');
        onMultipleFound(trimmed);
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            setStatusMessage(
              isRTL ? 'وجه الكاميرا إلى الباركود' : 'Point the camera at the barcode'
            );
            setStatusType('idle');
          }
        }, 2000);
      }
    },
    [products, isRTL, settings, onProductFound, onProductNotFound, onMultipleFound, continuousMode, stopCamera, onClose]
  );

  // ── Start Camera ─────────────────────────────────────────────────────────

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (isUnmountedRef.current) return;
      setIsLoading(true);

      try {
        // Get available cameras first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));

        if (!isUnmountedRef.current) {
          setCameras(videoDevices);
        }

        const chosenDeviceId = deviceId || videoDevices[0]?.deviceId;
        if (chosenDeviceId && !isUnmountedRef.current) {
          setSelectedCamera(chosenDeviceId);
        }

        const constraints: MediaStreamConstraints = {
          video: chosenDeviceId
            ? { deviceId: { exact: chosenDeviceId } }
            : { facingMode: 'environment' },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (isUnmountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Dynamically import ZXing to avoid SSR / test issues
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (isUnmountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const codeReader = new BrowserMultiFormatReader();
        scannerRef.current = codeReader;

        if (videoRef.current) {
          codeReader.decodeFromVideoElement(videoRef.current, (result, error) => {
            if (isUnmountedRef.current) return;
            if (result) {
              handleRawScan(result.getText());
            }
            // Ignore errors (null result means no barcode detected in this frame)
          });
        }

        if (!isUnmountedRef.current) {
          setCameraActive(true);
          setIsLoading(false);
          setStatusMessage(
            isRTL ? 'وجه الكاميرا إلى الباركود' : 'Point the camera at the barcode'
          );
        }
      } catch (err: any) {
        if (!isUnmountedRef.current) {
          setIsLoading(false);
          const msg =
            err?.name === 'NotAllowedError'
              ? isRTL
                ? 'تم رفض إذن الكاميرا. يرجى السماح بالوصول.'
                : 'Camera permission denied.'
              : isRTL
              ? 'تعذر فتح الكاميرا.'
              : 'Could not open camera.';
          setStatusMessage(msg);
          setStatusType('error');
        }
      }
    },
    [handleRawScan, isRTL]
  );

  // ── Handle camera switch ─────────────────────────────────────────────────

  const handleSwitchCamera = useCallback(
    async (deviceId: string) => {
      setIsCameraDropdownOpen(false);
      await stopCamera();
      await startCamera(deviceId);
    },
    [stopCamera, startCamera]
  );

  // ── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    isUnmountedRef.current = false;
    if (settings.enable_camera_scanner) {
      startCamera();
    }
    return () => {
      isUnmountedRef.current = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── HID Scanner handler ──────────────────────────────────────────────────

  const handleHIDScan = useCallback(
    (barcode: string) => {
      handleRawScan(barcode);
    },
    [handleRawScan]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const statusColors = {
    idle: 'text-slate-500',
    success: 'text-emerald-600',
    error: 'text-rose-600',
  };

  const frameBorderColor = {
    idle: 'border-indigo-400',
    success: 'border-emerald-400',
    error: 'border-rose-400',
  };

  return (
    <>
      {/* HID Scanner listener — invisible */}
      <HIDScannerListener
        enabled={settings.enable_hid_scanner}
        onScan={handleHIDScan}
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            stopCamera();
            onClose();
          }
        }}
      >
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-purple-600">
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-white" />
              <h2 className="text-base font-bold text-white">
                {continuousMode
                  ? isRTL ? 'قراءة مستمرة للباركود' : 'Continuous Barcode Scan'
                  : isRTL ? 'قراءة الباركود' : 'Scan Barcode'}
              </h2>
              {continuousMode && (
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                  {isRTL ? 'مستمر' : 'Continuous'}
                </span>
              )}
            </div>
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Camera selector */}
          {cameras.length > 1 && (
            <div className="px-4 pt-3 pb-0 relative">
              <button
                type="button"
                onClick={() => setIsCameraDropdownOpen(!isCameraDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-500" />
                  <span className="truncate">
                    {cameras.find((c) => c.deviceId === selectedCamera)?.label ||
                      (isRTL ? 'اختر الكاميرا' : 'Select Camera')}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCameraDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCameraDropdownOpen && (
                <div className="absolute left-4 right-4 top-full mt-1 z-10 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {cameras.map((cam) => (
                    <button
                      key={cam.deviceId}
                      type="button"
                      onClick={() => handleSwitchCamera(cam.deviceId)}
                      className={`w-full text-start px-3 py-2.5 text-sm font-medium hover:bg-indigo-50 transition-colors ${
                        selectedCamera === cam.deviceId
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Video viewfinder */}
          <div className="relative mx-4 mt-4 rounded-2xl overflow-hidden bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Scan frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`relative w-56 h-36 border-2 rounded-xl transition-colors duration-300 ${frameBorderColor[statusType]}`}
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
              >
                {/* Corner markers */}
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
                ].map((cls, i) => (
                  <div
                    key={i}
                    className={`absolute w-5 h-5 border-indigo-400 ${cls}`}
                  />
                ))}

                {/* Animated scan line */}
                {cameraActive && statusType === 'idle' && (
                  <div
                    className="absolute left-1 right-1 h-0.5 bg-indigo-400/80 rounded-full"
                    style={{
                      animation: 'scanLine 2s linear infinite',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                <p className="text-white text-sm font-medium">
                  {isRTL ? 'جاري فتح الكاميرا...' : 'Opening camera...'}
                </p>
              </div>
            )}

            {/* Camera disabled state */}
            {!isLoading && !cameraActive && !settings.enable_camera_scanner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <CameraOff className="w-12 h-12 text-white/50 mb-2" />
                <p className="text-white/70 text-sm font-medium text-center px-4">
                  {isRTL
                    ? 'الكاميرا معطلة. استخدم Barcode Scanner.'
                    : 'Camera disabled. Use a Barcode Scanner.'}
                </p>
              </div>
            )}
          </div>

          {/* Status message */}
          <div className="px-4 pt-3 pb-1 min-h-[48px] flex items-center justify-center">
            <p className={`text-sm font-semibold text-center transition-colors ${statusColors[statusType]}`}>
              {statusMessage}
            </p>
          </div>

          {/* Last scanned barcode */}
          {lastScannedBarcode && continuousMode && (
            <div className="mx-4 mb-2 px-3 py-1.5 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {isRTL ? 'آخر قراءة:' : 'Last scan:'}
              </span>
              <span className="text-xs font-mono font-bold text-slate-700">
                {lastScannedBarcode}
              </span>
            </div>
          )}

          {/* HID scanner active notice */}
          {settings.enable_hid_scanner && (
            <div className="mx-4 mb-3 px-3 py-2 bg-indigo-50 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
              <p className="text-xs text-indigo-700 font-medium">
                {isRTL
                  ? 'Scanner USB/Bluetooth جاهز — مسح الباركود تلقائي'
                  : 'USB/Bluetooth scanner ready — scan anytime'}
              </p>
            </div>
          )}

          {/* Footer buttons */}
          <div className="px-4 pb-4 flex gap-2">
            {cameraActive ? (
              <button
                type="button"
                onClick={() => { stopCamera(); if (!continuousMode) onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-sm rounded-xl transition-colors"
              >
                <CameraOff className="w-4 h-4" />
                {isRTL ? 'إيقاف القراءة' : 'Stop Scanning'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startCamera(selectedCamera)}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {isRTL ? 'تشغيل الكاميرا' : 'Start Camera'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { stopCamera(); onClose(); }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-xl transition-colors"
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>

      {/* Scan line animation */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 8px; opacity: 1; }
          48%  { opacity: 1; }
          50%  { top: calc(100% - 8px); opacity: 0.6; }
          52%  { opacity: 1; }
          100% { top: 8px; opacity: 1; }
        }
      `}</style>
    </>
  );
}
