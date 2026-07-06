import React from 'react';
import { pdf } from '@react-pdf/renderer';

/**
 * Compiles a React @react-pdf/renderer Document component asynchronously into a blob
 * and triggers a browser download. Does not cause page freezing.
 */
export const downloadPDF = async (documentComponent: React.ReactElement, filename: string) => {
  try {
    const blob = await pdf(documentComponent).toBlob();
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PDF Export failed:', error);
    throw error;
  }
};
