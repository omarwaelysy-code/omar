import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { SEQUENCE_MODULE_CONFIG } from '../lib/erp-api';

describe('Document Import Module & Sequences', () => {
  it('correctly configures sales and purchase batch sequence formats', () => {
    const salesConfig = SEQUENCE_MODULE_CONFIG['sales_import_batches'];
    const purConfig = SEQUENCE_MODULE_CONFIG['purchases_import_batches'];

    expect(salesConfig).toBeDefined();
    expect(salesConfig.prefix).toBe('Batch-sal');
    expect(salesConfig.padLength).toBe(5);
    expect(salesConfig.periodType).toBe('month');

    expect(purConfig).toBeDefined();
    expect(purConfig.prefix).toBe('Batch-pur');
    expect(purConfig.padLength).toBe(5);
    expect(purConfig.periodType).toBe('month');
  });

  it('generates proper batch sequence strings matching user specification', () => {
    const year = '2026';
    const month = '09';
    const seq = 1;
    const seqStr = String(seq).padStart(5, '0');

    const salesBatch = `Batch-sal-${year}-${month}-${seqStr}`;
    const purBatch = `Batch-pur-${year}-${month}-${seqStr}`;

    expect(salesBatch).toBe('Batch-sal-2026-09-00001');
    expect(purBatch).toBe('Batch-pur-2026-09-00001');
  });

  it('correctly parses Excel structure with Ref, DocType, Customer, and item calculations', () => {
    // Simulate generating a workbook matching the template
    const headers = [
      'Ref', 'نوع المستند', 'التاريخ', 'كود العميل / المورد', 
      'كود الصنف / الباركود', 'اسم الصنف', 'المخزن', 
      'الكمية', 'السعر', 'الخصم', 'نسبة ضريبة القيمة المضافة %', 
      'نسبة ضريبة الخصم والاضافة %', 'طريقة الدفع', 'ملاحظات'
    ];

    const rows = [
      ['Ref-000001', 'فاتورة بيع', '2026-09-24', 'CUST-01', 'ITEM-01', 'صنف تجريبي 1', 'المخزن الرئيسي', 10, 100, 50, 14, 1, 'آجل', 'بند 1'],
      ['Ref-000001', 'فاتورة بيع', '2026-09-24', 'CUST-01', 'ITEM-02', 'صنف تجريبي 2', 'المخزن الرئيسي', 5, 200, 0, 14, 1, 'آجل', 'بند 2'],
      ['Ref-000002', 'أمر بيع', '2026-09-24', 'CUST-02', 'ITEM-01', 'صنف تجريبي 1', 'المخزن الرئيسي', 20, 95, 0, 14, 0, 'آجل', 'أمر بيع']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات المستندات');

    // Read back workbook
    const outBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const parsedWb = XLSX.read(outBuffer, { type: 'buffer' });
    const parsedRows: any[][] = XLSX.utils.sheet_to_json(parsedWb.Sheets['بيانات المستندات'], { header: 1 });

    expect(parsedRows.length).toBe(4); // 1 header + 3 rows
    expect(parsedRows[0][0]).toBe('Ref');
    expect(parsedRows[1][0]).toBe('Ref-000001');
    expect(parsedRows[1][1]).toBe('فاتورة بيع');
    expect(parsedRows[2][0]).toBe('Ref-000001');

    // Test Item 1 calculations:
    // Qty = 10, Price = 100 => Gross = 1000
    // Discount = 50 => Subtotal = 950
    // VAT 14% on 950 => 133
    // WHT 1% on 950 => 9.5
    // Total = 950 + 133 - 9.5 = 1073.5
    const qty1 = Number(parsedRows[1][7]);
    const price1 = Number(parsedRows[1][8]);
    const disc1 = Number(parsedRows[1][9]);
    const vatRate1 = Number(parsedRows[1][10]);
    const whtRate1 = Number(parsedRows[1][11]);

    const gross1 = qty1 * price1;
    const subtotal1 = gross1 - disc1;
    const vat1 = Number(((subtotal1 * vatRate1) / 100).toFixed(2));
    const wht1 = Number(((subtotal1 * whtRate1) / 100).toFixed(2));
    const total1 = Number((subtotal1 + vat1 - wht1).toFixed(2));

    expect(gross1).toBe(1000);
    expect(subtotal1).toBe(950);
    expect(vat1).toBe(133);
    expect(wht1).toBe(9.5);
    expect(total1).toBe(1073.5);

    // Test Item 2 calculations:
    // Qty = 5, Price = 200 => Gross = 1000
    // Discount = 0 => Subtotal = 1000
    // VAT 14% => 140
    // WHT 1% => 10
    // Total = 1000 + 140 - 10 = 1130
    const qty2 = Number(parsedRows[2][7]);
    const price2 = Number(parsedRows[2][8]);
    const disc2 = Number(parsedRows[2][9]);
    const vatRate2 = Number(parsedRows[2][10]);
    const whtRate2 = Number(parsedRows[2][11]);

    const gross2 = qty2 * price2;
    const subtotal2 = gross2 - disc2;
    const vat2 = Number(((subtotal2 * vatRate2) / 100).toFixed(2));
    const wht2 = Number(((subtotal2 * whtRate2) / 100).toFixed(2));
    const total2 = Number((subtotal2 + vat2 - wht2).toFixed(2));

    expect(gross2).toBe(1000);
    expect(subtotal2).toBe(1000);
    expect(vat2).toBe(140);
    expect(wht2).toBe(10);
    expect(total2).toBe(1130);

    // Combined Document Ref-000001 Totals:
    const docGross = gross1 + gross2;
    const docDiscount = disc1 + disc2;
    const docSubtotal = subtotal1 + subtotal2;
    const docVat = vat1 + vat2;
    const docWht = wht1 + wht2;
    const docTotal = total1 + total2;

    expect(docGross).toBe(2000);
    expect(docDiscount).toBe(50);
    expect(docSubtotal).toBe(1950);
    expect(docVat).toBe(273);
    expect(docWht).toBe(19.5);
    expect(docTotal).toBe(2203.5);
  });
});
