import { describe, it, expect } from 'vitest';
import { generatePDF } from '../lib/pdf-generator';

describe('PDF Engine Architectural Tests', () => {

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
