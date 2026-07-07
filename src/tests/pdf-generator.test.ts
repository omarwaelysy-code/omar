import { describe, it, expect } from 'vitest';
import { generatePDF } from '../lib/pdf/index';
import { shapeArabicText, prepareTextLine, wrapRtlText } from '../lib/pdf/PdfText';
import PDFDocument from 'pdfkit';

describe('PDF Engine Architectural Tests', () => {

  describe('Arabic RTL & Shaping Engine', () => {
    it('should shape Arabic letters correctly based on connections', () => {
      // "كتب" -> Initial Kaf + Medial Ta + Final Ba
      const shaped = shapeArabicText('كتب');
      // Verify letters map to their Arabic Presentation Forms-B equivalents
      expect(shaped.charCodeAt(0)).toBe(0xFEDB); // Initial Kaf
      expect(shaped.charCodeAt(1)).toBe(0xFE98); // Medial Ta
      expect(shaped.charCodeAt(2)).toBe(0xFE90); // Final Ba
    });

    it('should shape Lam-Alef ligatures properly', () => {
      const shaped = shapeArabicText('لا');
      expect(shaped.charCodeAt(0)).toBe(0xFEFB); // Isolated Lam-Alef
    });

    it('should format mixed Arabic/English lines in RTL order', () => {
      // Arabic segment followed by English code
      const line = prepareTextLine('الرصيد INV-123');
      // English segment "INV-123 " should remain LTR, Arabic text reversed, segments reversed
      expect(line.startsWith('INV-123 ')).toBe(true);
    });

    it('should wrap RTL text correctly without splitting middle of words', () => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.registerFont('NotoSansArabic', './public/fonts/NotoSansArabic-Regular.ttf');
      doc.font('NotoSansArabic').fontSize(9);

      const longParagraph = 'هذا النص عبارة عن تجربة لعملية التفاف الأسطر الطويلة باللغة العربية داخل ملف PDF';
      const lines = wrapRtlText(doc, longParagraph, 150);

      expect(lines.length).toBeGreaterThan(1);
      // Ensure words remain intact and not split character-by-character
      expect(lines[0].includes(' ')).toBe(true);
    });
  });

  describe('PDF Buffer Generation', () => {
    const mockCompany = {
      name: 'شركة تجريبية للأنظمة السحابية',
      taxNumber: '310123456700003',
      phone: '0112345678',
      logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    };

    it('should generate a valid Sales Invoice PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        invoice_number: 'INV-2026-001',
        date: '2026-07-08',
        payment_method: 'نقدي',
        customer_name: 'عميل تجريبي متميز',
        customer_tax_number: '123456789012345',
        customer_phone: '0555555555',
        items: [
          {
            product_code: 'PRD-001',
            product_name: 'جهاز كمبيوتر محمول فخم جداً ذو شاشة ممتازة',
            quantity: '2',
            unit: 'جهاز',
            unit_price: '3000.00',
            discount: '0.00',
            vat_amount: '900.00',
            total: '6900.00'
          }
        ],
        subtotal: '6000.00',
        discount_amount: '0.00',
        vat_amount: '900.00',
        net_total: '6900.00',
        branchName: 'الفرع الرئيسي بالرياض',
        userName: 'أحمد المحاسب'
      };

      const buffer = await generatePDF('SalesInvoicePdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      // PDF files always start with %PDF- header signature
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid Customer Statement PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        customer_name: 'مؤسسة النور للتجارة',
        date_from: '2026-01-01',
        date_to: '2026-06-30',
        starting_balance: '15000.00',
        ending_balance: '22000.00',
        total_debit: '12000.00',
        total_credit: '5000.00',
        rows: [
          {
            date: '2026-02-10',
            reference: 'INV-1002',
            description: 'شراء بضاعة ومستلزمات مكتبية',
            debit: '7000.00',
            credit: '0.00',
            balance: '22000.00'
          }
        ],
        branchName: 'فرع جدة',
        userName: 'سارة المشرف'
      };

      const buffer = await generatePDF('CustomerStatementPdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid Receipt/Payment Voucher PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        voucher_number: 'VCH-50021',
        date: '2026-07-08',
        payment_method: 'حوالة بنكية',
        party_name: 'شركة العليان التجارية',
        amount: '4500.00',
        description: 'دفعة تحت الحساب لقاء أعمال الصيانة والتشغيل الدورية',
        items: [],
        branchName: 'الفرع الرئيسي',
        userName: 'خالد عبد الله',
        isReceipt: false
      };

      const buffer = await generatePDF('VoucherPdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should fallback to default generic report layout successfully', async () => {
      const dto = {
        company: mockCompany,
        reportTitle: 'تقرير جرد المستودعات السنوي',
        columns: [
          { id: 'code', label: 'كود المستودع', width: 30 },
          { id: 'name', label: 'اسم المستودع', width: 40 },
          { id: 'value', label: 'القيمة التقديرية', width: 30 }
        ],
        rows: [
          { code: 'WH-01', name: 'المستودع الرئيسي بالرياض', value: '450,000.00' },
          { code: 'WH-02', name: 'مستودع المنطقة الغربية بجدة', value: '320,000.00' }
        ],
        totals: { code: 'الإجمالي', name: '', value: '770,000.00' },
        branchName: 'الإدارة العامة',
        userName: 'محمد المدير'
      };

      const buffer = await generatePDF('CustomReportTemplate', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });
  });
});
