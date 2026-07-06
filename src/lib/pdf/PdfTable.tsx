import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { shapeArabicText } from './PdfHelpers';
import { pdfColors } from './PdfTheme';

const styles = StyleSheet.create({
  table: {
    width: '100%',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: pdfColors.border,
    borderRadius: 4,
    overflow: 'hidden'
  },
  headerRow: {
    flexDirection: 'row-reverse',
    backgroundColor: pdfColors.primary,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    minHeight: 24,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  headerCell: {
    color: pdfColors.white,
    fontWeight: 'bold',
    fontSize: 8,
    padding: 4
  },
  bodyRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    minHeight: 20,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  bodyRowEven: {
    backgroundColor: pdfColors.bgLight
  },
  bodyCell: {
    fontSize: 7.5,
    padding: 4,
    color: pdfColors.text
  },
  totalRow: {
    flexDirection: 'row-reverse',
    backgroundColor: pdfColors.bgLight,
    borderTopWidth: 1.5,
    borderTopColor: pdfColors.primary,
    minHeight: 24,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  totalCell: {
    fontWeight: 'bold',
    fontSize: 8,
    padding: 4,
    color: pdfColors.primaryDark
  }
});

interface TableColumn {
  id: string;
  label: string;
  width?: number; // relative width (flex weight or percent)
  align?: 'left' | 'center' | 'right';
}

interface PdfTableProps {
  columns: TableColumn[];
  data: any[];
  showTotals?: boolean;
  totals?: { [key: string]: number | string };
}

export const PdfTable: React.FC<PdfTableProps> = ({
  columns,
  data,
  showTotals = false,
  totals = {}
}) => {
  // Distribute flex weights: if column doesn't specify width, default to flex: 1
  const getColStyle = (col: TableColumn) => {
    const align = col.align || 'right';
    return {
      flex: col.width || 1,
      textAlign: (align === 'right' ? 'right' : align === 'left' ? 'left' : 'center') as 'right' | 'left' | 'center'
    };
  };

  return (
    <View style={styles.table}>
      {/* 1. Header Row (repeated on page breaks if page is large) */}
      <View style={styles.headerRow} fixed>
        {columns.map((col, index) => (
          <Text 
            key={col.id} 
            style={[styles.headerCell, getColStyle(col)]}
          >
            {shapeArabicText(col.label)}
          </Text>
        ))}
      </View>

      {/* 2. Body Rows */}
      {data.map((row, rowIndex) => {
        const isEven = rowIndex % 2 === 1;
        return (
          <View 
            key={rowIndex} 
            style={[styles.bodyRow, isEven ? styles.bodyRowEven : null]}
            wrap={false} // Prevent individual row from breaking across pages
          >
            {columns.map((col) => (
              <Text 
                key={col.id} 
                style={[styles.bodyCell, getColStyle(col)]}
              >
                {shapeArabicText(row[col.id] !== undefined ? row[col.id] : '')}
              </Text>
            ))}
          </View>
        );
      })}

      {/* 3. Totals Row */}
      {showTotals && (
        <View style={styles.totalRow} wrap={false}>
          {columns.map((col, index) => {
            const hasTotal = totals[col.id] !== undefined;
            const isFirstCol = index === 0;
            let displayVal = '';
            if (hasTotal) {
              displayVal = String(totals[col.id]);
            } else if (isFirstCol) {
              displayVal = 'الإجمالي';
            }
            return (
              <Text 
                key={col.id} 
                style={[styles.totalCell, getColStyle(col)]}
              >
                {shapeArabicText(displayVal)}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
};
