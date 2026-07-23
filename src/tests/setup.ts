import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Global top-level module mocks
vi.mock('react-barcode', () => ({
  default: () => null
}));

vi.mock('react-qr-code', () => ({
  default: () => null
}));

vi.mock('@zxing/browser', () => {
  return {
    BrowserMultiFormatReader: class {
      decodeFromVideoElement = vi.fn((videoEl, callback) => {
        // Store for simulating raw scans in tests
        (globalThis as any).__mockZXingScan = callback;
      });
      stop = vi.fn().mockResolvedValue(undefined);
    }
  };
});

vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { style: { width: 800, height: 400 } }, children),
  };
});

if (typeof window !== 'undefined') {

  // Mock HTMLMediaElement.prototype.play
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock navigator.mediaDevices
  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [
            { stop: vi.fn() }
          ]
        }),
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'videoinput', deviceId: 'cam-1', label: 'Primary Camera' },
          { kind: 'videoinput', deviceId: 'cam-2', label: 'Secondary Camera' }
        ])
      }
    });
  }

  // Mock Web Audio API AudioContext
  class MockAudioContext {
    currentTime = 0;
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        connect: vi.fn()
      };
    }
    destination = {};
    close() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: MockAudioContext
  });
  Object.defineProperty(window, 'webkitAudioContext', {
    writable: true,
    value: MockAudioContext
  });
}
