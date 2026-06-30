import { useCallback, useRef } from 'react';
import { Product } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BarcodeScannerSettings {
  enable_camera_scanner: boolean;
  enable_hid_scanner: boolean;
  enable_continuous_mode: boolean;
  play_sound_on_success: boolean;
  prevent_unknown_items: boolean;
  auto_increase_quantity: boolean;
  show_success_message: boolean;
}

export const DEFAULT_BARCODE_SETTINGS: BarcodeScannerSettings = {
  enable_camera_scanner: true,
  enable_hid_scanner: true,
  enable_continuous_mode: true,
  play_sound_on_success: true,
  prevent_unknown_items: true,
  auto_increase_quantity: true,
  show_success_message: true,
};

export interface ScanResult {
  type: 'found' | 'not_found' | 'multiple';
  product?: Product;
  barcode: string;
}

// ─── Audio Helpers ──────────────────────────────────────────────────────────

/**
 * Plays a short beep using the Web Audio API.
 * No external audio files needed.
 */
export function playBeep(type: 'success' | 'error'): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.value = 1800;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Error: two low-pitch beeps
      osc.frequency.value = 400;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 350;
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.22);

      ctx.close();
    }

    // Auto-close context after playback
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Web Audio not available — silently ignore
  }
}

// ─── Product Lookup ──────────────────────────────────────────────────────────

/**
 * Searches products array by barcode string.
 * Returns ScanResult with type 'found', 'not_found', or 'multiple'.
 */
export function lookupProductByBarcode(barcode: string, products: Product[]): ScanResult {
  const trimmed = barcode.trim();
  if (!trimmed) return { type: 'not_found', barcode: trimmed };

  const matches = products.filter(
    (p) => p.barcode && p.barcode.trim() === trimmed
  );

  if (matches.length === 0) return { type: 'not_found', barcode: trimmed };
  if (matches.length === 1) return { type: 'found', product: matches[0], barcode: trimmed };
  return { type: 'multiple', barcode: trimmed };
}

// ─── Main Hook ───────────────────────────────────────────────────────────────

export interface UseBarcodeScanner {
  processScannedBarcode: (
    barcode: string,
    products: Product[],
    settings: BarcodeScannerSettings,
    callbacks: {
      onFound: (product: Product) => void;
      onNotFound: (barcode: string) => void;
      onMultiple: (barcode: string) => void;
    }
  ) => void;
  confirmationBufferRef: React.MutableRefObject<Map<string, number>>;
  resetConfirmationBuffer: () => void;
}

/**
 * Hook that provides barcode processing logic with confirmation counting.
 * A barcode must be read CONFIRMATION_THRESHOLD times in a row before being accepted.
 */
export function useBarcodeScanner(): UseBarcodeScanner {
  const CONFIRMATION_THRESHOLD = 3;
  // Map<barcode, count>
  const confirmationBufferRef = useRef<Map<string, number>>(new Map());
  const lastCodeRef = useRef<string>('');

  const resetConfirmationBuffer = useCallback(() => {
    confirmationBufferRef.current.clear();
    lastCodeRef.current = '';
  }, []);

  const processScannedBarcode = useCallback(
    (
      barcode: string,
      products: Product[],
      settings: BarcodeScannerSettings,
      callbacks: {
        onFound: (product: Product) => void;
        onNotFound: (barcode: string) => void;
        onMultiple: (barcode: string) => void;
      }
    ) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;

      // Reset if a different barcode is seen
      if (trimmed !== lastCodeRef.current) {
        confirmationBufferRef.current.clear();
        lastCodeRef.current = trimmed;
      }

      const currentCount = (confirmationBufferRef.current.get(trimmed) || 0) + 1;
      confirmationBufferRef.current.set(trimmed, currentCount);

      // Not yet confirmed
      if (currentCount < CONFIRMATION_THRESHOLD) return;

      // Confirmed — reset and process
      confirmationBufferRef.current.clear();
      lastCodeRef.current = '';

      const result = lookupProductByBarcode(trimmed, products);

      if (result.type === 'found' && result.product) {
        if (settings.play_sound_on_success) playBeep('success');
        callbacks.onFound(result.product);
      } else if (result.type === 'not_found') {
        playBeep('error');
        callbacks.onNotFound(trimmed);
      } else {
        playBeep('error');
        callbacks.onMultiple(trimmed);
      }
    },
    []
  );

  return { processScannedBarcode, confirmationBufferRef, resetConfirmationBuffer };
}
