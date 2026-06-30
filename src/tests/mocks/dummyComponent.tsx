import React from 'react';
export default function DummyComponent({ value, format, size, ...props }: any) {
  return <div data-testid="mock-barcode-qrcode" {...props} />;
}
