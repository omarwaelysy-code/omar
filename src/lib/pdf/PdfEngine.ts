import { Document, Page, View, Text, Image, Link, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from './PdfFonts';

// Auto-register fonts on module import
registerPdfFonts();

export { Document, Page, View, Text, Image, Link, StyleSheet };
export * from './PdfFonts';
export * from './PdfTheme';
export * from './PdfHelpers';
export * from './PdfHeader';
export * from './PdfFooter';
export * from './PdfTable';
export * from './PdfExporter';
