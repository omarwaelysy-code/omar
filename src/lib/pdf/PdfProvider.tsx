import React, { useEffect } from 'react';
import { registerPdfFonts } from './PdfFonts';

interface PdfProviderProps {
  children: React.ReactNode;
}

/**
 * Initializes PDF font registrations when the application mounts.
 */
export const PdfProvider: React.FC<PdfProviderProps> = ({ children }) => {
  useEffect(() => {
    try {
      registerPdfFonts();
    } catch (e) {
      console.warn('PDF fonts could not be pre-registered:', e);
    }
  }, []);

  return <>{children}</>;
};
