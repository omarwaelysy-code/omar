export const PdfTheme = {
  colors: {
    primary: '#10b981',       // Emerald (system main theme color)
    primaryDark: '#064e3b',   // Dark emerald
    text: '#1f2937',          // Dark gray text
    textLight: '#4b5563',     // Gray description text
    textMuted: '#9ca3af',     // Muted text
    border: '#e5e7eb',        // Border light gray
    bgLight: '#f9fafb',       // Row alternating background
    white: '#ffffff'
  },
  fonts: {
    regular: 'NotoSansArabic',
    bold: 'NotoSansArabic-Bold'
  },
  dimensions: {
    margin: 36, // ~0.5 inch (36 points in PDFKit)
    pageWidth: 595.28,  // A4 width in points
    pageHeight: 841.89  // A4 height in points
  }
};
