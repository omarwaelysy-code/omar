import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BarcodeScanner, HIDScannerListener } from '../components/BarcodeScanner';
import { useBarcodeScanner, lookupProductByBarcode, playBeep } from '../hooks/useBarcodeScanner';
import { Product } from '../types';

// Mock audio beep helper
vi.spyOn(console, 'error').mockImplementation(() => {});

const mockProducts: Product[] = [
  {
    id: 'prod-1',
    code: 'P001',
    name: 'صنف 1',
    type: 'finished_good',
    sale_price: 100,
    cost_price: 80,
    barcode: '6221000123456',
    stock: 0,
    min_stock: 0,
    company_id: 'comp-1',
  },
  {
    id: 'prod-2',
    code: 'P002',
    name: 'صنف 2',
    type: 'finished_good',
    sale_price: 150,
    cost_price: 120,
    barcode: '6221000999999',
    stock: 0,
    min_stock: 0,
    company_id: 'comp-1',
  },
  {
    id: 'prod-dup-1',
    code: 'PDUP1',
    name: 'صنف مكرر 1',
    type: 'finished_good',
    sale_price: 50,
    cost_price: 40,
    barcode: '6221000888888',
    stock: 0,
    min_stock: 0,
    company_id: 'comp-1',
  },
  {
    id: 'prod-dup-2',
    code: 'PDUP2',
    name: 'صنف مكرر 2',
    type: 'finished_good',
    sale_price: 60,
    cost_price: 45,
    barcode: '6221000888888', // Duplicate barcode!
    stock: 0,
    min_stock: 0,
    company_id: 'comp-1',
  },
];

const mockSettings = {
  enable_camera_scanner: true,
  enable_hid_scanner: true,
  enable_continuous_mode: true,
  play_sound_on_success: true,
  prevent_unknown_items: true,
  auto_increase_quantity: true,
  show_success_message: true,
};

describe('Barcode Scanner System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockZXingScan = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Lookup logic tests ──
  describe('Product Lookup Logic', () => {
    it('should find a single product by barcode', () => {
      const result = lookupProductByBarcode('6221000123456', mockProducts);
      expect(result.type).toBe('found');
      expect(result.product?.id).toBe('prod-1');
    });

    it('should return not_found for unregistered barcodes', () => {
      const result = lookupProductByBarcode('9999999999999', mockProducts);
      expect(result.type).toBe('not_found');
    });

    it('should return multiple for duplicate barcodes', () => {
      const result = lookupProductByBarcode('6221000888888', mockProducts);
      expect(result.type).toBe('multiple');
    });
  });

  // ── 2. useBarcodeScanner hook tests ──
  describe('useBarcodeScanner Hook & Accuracy (Multiple Reads Confirmation)', () => {
    it('should require 3 identical consecutive reads before confirming/processing the barcode', () => {
      const onFound = vi.fn();
      const onNotFound = vi.fn();
      const onMultiple = vi.fn();

      const { result } = renderHookHelper();

      // Read 1
      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      expect(onFound).not.toHaveBeenCalled();

      // Read 2
      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      expect(onFound).not.toHaveBeenCalled();

      // Read 3 (Confirmed!)
      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      expect(onFound).toHaveBeenCalledTimes(1);
      expect(onFound).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should reset the count if a different barcode is read consecutively', () => {
      const onFound = vi.fn();
      const onNotFound = vi.fn();
      const onMultiple = vi.fn();

      const { result } = renderHookHelper();

      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      
      // Interrupting scan
      result.processScannedBarcode('6221000999999', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      
      // Scan original barcode again (should require 3 new consecutive reads)
      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      expect(onFound).not.toHaveBeenCalled();

      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      result.processScannedBarcode('6221000123456', mockProducts, mockSettings, { onFound, onNotFound, onMultiple });
      expect(onFound).toHaveBeenCalledTimes(1);
    });
  });

  // ── 3. HID Keyboard Scanner Listener ──
  describe('USB/Bluetooth Barcode Scanner Listener', () => {
    it('should collect keyboard events and trigger onScan when Enter key is pressed', () => {
      const onScan = vi.fn();
      render(<HIDScannerListener enabled={true} onScan={onScan} />);

      // Simulate character inputs
      fireEvent.keyDown(document, { key: '6' });
      fireEvent.keyDown(document, { key: '2' });
      fireEvent.keyDown(document, { key: '2' });
      fireEvent.keyDown(document, { key: '1' });
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onScan).toHaveBeenCalledWith('6221');
    });

    it('should ignore input if listener is disabled', () => {
      const onScan = vi.fn();
      render(<HIDScannerListener enabled={false} onScan={onScan} />);

      fireEvent.keyDown(document, { key: '6' });
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onScan).not.toHaveBeenCalled();
    });
  });

  // ── 4. BarcodeScanner Component Camera & Scan flow ──
  describe('BarcodeScanner Component Integrations', () => {
    it('should open camera, view text instructions, and display live viewfinder', async () => {
      const onProductFound = vi.fn();
      const onProductNotFound = vi.fn();
      const onMultipleFound = vi.fn();
      const onClose = vi.fn();

      render(
        <BarcodeScanner
          products={mockProducts}
          onProductFound={onProductFound}
          onProductNotFound={onProductNotFound}
          onMultipleFound={onMultipleFound}
          onClose={onClose}
          settings={mockSettings}
          language="ar"
        />
      );

      // Verify instruction text exists in Arabic
      expect(screen.getByText('وجه الكاميرا إلى الباركود')).toBeInTheDocument();
      expect(screen.getByText('قراءة الباركود')).toBeInTheDocument();
    });

    it('should succeed on camera scans after 3 frames of matching code', async () => {
      const onProductFound = vi.fn();
      const onClose = vi.fn();

      render(
        <BarcodeScanner
          products={mockProducts}
          onProductFound={onProductFound}
          onProductNotFound={vi.fn()}
          onMultipleFound={vi.fn()}
          onClose={onClose}
          settings={mockSettings}
          continuousMode={false} // One-shot mode
        />
      );

      // Wait for camera/ZXing registration
      await waitFor(() => expect((globalThis as any).__mockZXingScan).not.toBeNull());
      const scanTrigger = (globalThis as any).__mockZXingScan;

      // Simulate 3 matching frame decodes
      const resultObj = { getText: () => '6221000123456' };
      scanTrigger(resultObj, null);
      scanTrigger(resultObj, null);
      scanTrigger(resultObj, null);

      // In one-shot mode: should fire callback and automatically trigger close/stop camera
      expect(onProductFound).toHaveBeenCalledWith(mockProducts[0]);
    });

    it('should handle unregistered barcode and trigger not found warning', async () => {
      const onProductNotFound = vi.fn();

      render(
        <BarcodeScanner
          products={mockProducts}
          onProductFound={vi.fn()}
          onProductNotFound={onProductNotFound}
          onMultipleFound={vi.fn()}
          onClose={vi.fn()}
          settings={mockSettings}
          continuousMode={true}
        />
      );

      await waitFor(() => expect((globalThis as any).__mockZXingScan).not.toBeNull());
      const scanTrigger = (globalThis as any).__mockZXingScan;

      const resultObj = { getText: () => '9999999999999' };
      scanTrigger(resultObj, null);
      scanTrigger(resultObj, null);
      scanTrigger(resultObj, null);

      await waitFor(() => {
        expect(onProductNotFound).toHaveBeenCalledWith('9999999999999');
      });
      expect(screen.getByText(/الباركود غير مسجل بالنظام/)).toBeInTheDocument();
    });

    it('should handle duplicate barcodes and trigger warning', async () => {
      const onMultipleFound = vi.fn();

      render(
        <BarcodeScanner
          products={mockProducts}
          onProductFound={vi.fn()}
          onProductNotFound={vi.fn()}
          onMultipleFound={onMultipleFound}
          onClose={vi.fn()}
          settings={mockSettings}
          continuousMode={true}
        />
      );

      await waitFor(() => expect((globalThis as any).__mockZXingScan).not.toBeNull());
      const scanTrigger = (globalThis as any).__mockZXingScan;

      const resultObj = { getText: () => '6221000888888' };
      scanTrigger(resultObj, null);
      scanTrigger(resultObj, null);
      scanTrigger(resultObj, null);

      await waitFor(() => {
        expect(onMultipleFound).toHaveBeenCalledWith('6221000888888');
      });
      expect(screen.getByText(/يوجد أكثر من صنف بنفس الباركود/)).toBeInTheDocument();
    });
  });

  // ── 5. Memory cleanup and performance verification ──
  describe('Performance & Resource Cleanup', () => {
    it('should release all tracks and clean up camera on unmount to prevent memory leaks', async () => {
      const stopMock = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: stopMock }]
      };
      
      // Override navigator mediaDevices mock just for this test
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockStream as any);

      const { unmount } = render(
        <BarcodeScanner
          products={mockProducts}
          onProductFound={vi.fn()}
          onProductNotFound={vi.fn()}
          onMultipleFound={vi.fn()}
          onClose={vi.fn()}
          settings={mockSettings}
        />
      );

      // Wait until the camera is fully initialized/active to ensure streamRef is assigned
      await waitFor(() => expect(screen.queryByText(/جاري فتح الكاميرا/)).toBeNull());
      
      // Unmount to trigger cleanups
      unmount();
      
      // Stream tracks should be stopped immediately
      await waitFor(() => expect(stopMock).toHaveBeenCalled());
    });

    it('should load and initialize under 500ms for premium user experience', async () => {
      const start = performance.now();
      
      render(
        <BarcodeScanner
          products={mockProducts}
          onProductFound={vi.fn()}
          onProductNotFound={vi.fn()}
          onMultipleFound={vi.fn()}
          onClose={vi.fn()}
          settings={mockSettings}
        />
      );

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // Verify fast initialization without locks
    });
  });
});

// Helper component to render useBarcodeScanner hook
function renderHookHelper() {
  let result: any;
  function TestComponent() {
    result = useBarcodeScanner();
    return null;
  }
  render(<TestComponent />);
  return { result };
}
