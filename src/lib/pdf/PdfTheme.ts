import { StyleSheet } from '@react-pdf/renderer';

export const pdfColors = {
  primary: '#10b981', // emerald-500
  primaryDark: '#064e3b', // emerald-900
  secondary: '#3b82f6', // blue-500
  text: '#1f2937', // zinc-800
  textMuted: '#4b5563', // zinc-600
  border: '#e5e7eb', // zinc-200
  bgLight: '#f9fafb', // zinc-50
  white: '#ffffff',
  accentRed: '#ef4444' // red-500
};

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 35,
    fontFamily: 'Noto Sans Arabic',
    fontSize: 9,
    color: pdfColors.text,
    backgroundColor: pdfColors.white,
    direction: 'rtl'
  },
  // Typography
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: pdfColors.primaryDark,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 9,
    color: pdfColors.textMuted,
    marginBottom: 10
  },
  boldText: {
    fontWeight: 'bold'
  },
  normalText: {
    fontWeight: 'normal'
  },
  // Layout utilities
  row: {
    flexDirection: 'row-reverse',
    width: '100%'
  },
  col: {
    flexDirection: 'column',
    flex: 1
  },
  spaceBetween: {
    justifyContent: 'space-between'
  },
  alignCenter: {
    alignItems: 'center'
  },
  // Divider line
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    marginVertical: 15,
    width: '100%'
  },
  // Total summary block
  totalContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    marginTop: 15,
    paddingRight: 10
  },
  totalBox: {
    borderWidth: 1.5,
    borderColor: pdfColors.primary,
    backgroundColor: pdfColors.bgLight,
    padding: 10,
    borderRadius: 6,
    width: 200,
    gap: 6
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    fontSize: 10
  },
  totalLabel: {
    color: pdfColors.textMuted
  },
  totalVal: {
    fontWeight: 'bold',
    color: pdfColors.primaryDark
  },
  // Signature Area
  signatureContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginTop: 50,
    width: '100%'
  },
  signatureBox: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 150
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.textMuted,
    width: '100%',
    marginBottom: 6,
    height: 30
  },
  signatureTitle: {
    fontSize: 9,
    color: pdfColors.textMuted,
    fontWeight: 'bold'
  }
});
