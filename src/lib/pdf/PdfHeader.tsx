import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { shapeArabicText } from './PdfHelpers';
import { pdfColors } from './PdfTheme';

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.primary,
    paddingBottom: 10,
    marginBottom: 15,
    width: '100%'
  },
  companyInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '40%'
  },
  logoBox: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderStyle: 'dashed',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoText: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 8,
    color: pdfColors.textMuted,
    fontWeight: 'bold'
  },
  titleInfo: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '40%'
  },
  reportTitle: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 16,
    fontWeight: 'bold',
    color: pdfColors.primaryDark,
    marginBottom: 4
  },
  metaInfo: {
    fontFamily: 'Noto Sans Arabic',
    flexDirection: 'column',
    alignItems: 'flex-end',
    width: '20%',
    fontSize: 8,
    color: pdfColors.textMuted,
    gap: 3
  },
  companyName: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 12,
    fontWeight: 'bold',
    color: pdfColors.primaryDark,
    marginBottom: 3
  },
  companyDetail: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 8,
    color: pdfColors.textMuted
  }
});

interface PdfHeaderProps {
  companyName?: string;
  companyLogo?: string;
  companyTaxNumber?: string;
  companyPhone?: string;
  reportTitle: string;
  branchName?: string;
  userName?: string;
  dateStr?: string;
}

export const PdfHeader: React.FC<PdfHeaderProps> = ({
  companyName = '',
  companyLogo = '',
  companyTaxNumber = '',
  companyPhone = '',
  reportTitle,
  branchName = '',
  userName = '',
  dateStr = ''
}) => {
  return (
    <View style={styles.headerContainer}>
      {/* 1. Company Name & logo */}
      <View style={styles.companyInfo}>
        {companyLogo ? (
          <View style={styles.logoBox}>
            <Image src={companyLogo} style={styles.logo} />
          </View>
        ) : (
          <View style={[styles.logoBox, styles.logoPlaceholder]}>
            <Text style={styles.logoText}>{shapeArabicText('[ LOGO ]')}</Text>
          </View>
        )}
        <Text style={styles.companyName}>{shapeArabicText(companyName)}</Text>
        {companyTaxNumber && (
          <Text style={styles.companyDetail}>
            {shapeArabicText(`الرقم الضريبي: ${companyTaxNumber}`)}
          </Text>
        )}
        {companyPhone && (
          <Text style={styles.companyDetail}>
            {shapeArabicText(`الهاتف: ${companyPhone}`)}
          </Text>
        )}
      </View>

      {/* 2. Report Title */}
      <View style={styles.titleInfo}>
        <Text style={styles.reportTitle}>{shapeArabicText(reportTitle)}</Text>
        {branchName && (
          <Text style={styles.companyDetail}>
            {shapeArabicText(`الفرع: ${branchName}`)}
          </Text>
        )}
      </View>

      {/* 3. Export Metadata */}
      <View style={styles.metaInfo}>
        <Text>{shapeArabicText(`المستخدم: ${userName || 'المشرف'}`)}</Text>
        <Text>{shapeArabicText(`التاريخ: ${dateStr || new Date().toLocaleDateString('ar-SA')}`)}</Text>
      </View>
    </View>
  );
};
