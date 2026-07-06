import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { shapeArabicText } from './PdfHelpers';
import { pdfColors } from './PdfTheme';

const styles = StyleSheet.create({
  footerContainer: {
    position: 'absolute',
    bottom: 25,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%'
  },
  footerText: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 7,
    color: pdfColors.textMuted
  }
});

interface PdfFooterProps {
  systemName?: string;
}

export const PdfFooter: React.FC<PdfFooterProps> = ({ systemName = 'نظام ERP السحابي' }) => {
  return (
    <View style={styles.footerContainer} fixed>
      {/* 1. System Stamp */}
      <Text style={styles.footerText}>{shapeArabicText(systemName)}</Text>

      {/* 2. Dynamic Page Numbers */}
      <Text 
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => (
          shapeArabicText(`صفحة ${pageNumber} من ${totalPages}`)
        )} 
      />
    </View>
  );
};
