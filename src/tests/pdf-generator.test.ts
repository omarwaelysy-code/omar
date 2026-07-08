// @vitest-environment node
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
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid Purchase Invoice PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        invoice_number: 'PINV-2026-99',
        date: '2026-07-08',
        payment_method: 'آجل',
        supplier_name: 'شركة التوريدات العالمية',
        supplier_tax_number: '310999999900003',
        supplier_phone: '0129998887',
        items: [
          {
            product_code: 'MAT-05',
            product_name: 'مواد خام للتصنيع والتعبئة والتغليف بأحجام مختلفة',
            quantity: '10',
            unit: 'طن',
            unit_price: '500.00',
            discount: '50.00',
            vat_amount: '67.50',
            total: '517.50'
          }
        ],
        subtotal: '5000.00',
        discount_amount: '500.00',
        vat_amount: '675.00',
        net_total: '5175.00',
        branchName: 'مستودع جدة الرئيسي',
        userName: 'فهد المشتريات'
      };

      const buffer = await generatePDF('PurchaseInvoicePdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
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

    it('should generate a valid Supplier Statement PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        supplier_name: 'شركة الجزيرة للمقاولات',
        date_from: '2026-01-01',
        date_to: '2026-06-30',
        starting_balance: '8000.00',
        ending_balance: '13000.00',
        total_debit: '5000.00',
        total_credit: '10000.00',
        rows: [
          {
            date: '2026-04-15',
            reference: 'PAY-8822',
            description: 'دفعة نقدية تحت حساب الصيانة والمقاولات المستحقة للربع الأول',
            debit: '5000.00',
            credit: '0.00',
            balance: '3000.00'
          }
        ],
        branchName: 'الفرع الرئيسي',
        userName: 'سليمان المالي'
      };

      const buffer = await generatePDF('SupplierStatementPdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid General Ledger PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        date_from: '2026-01-01',
        date_to: '2026-06-30',
        total_debit: '18500.00',
        total_credit: '18500.00',
        rows: [
          {
            date: '2026-03-01',
            entry_num: 'JV-1001',
            account_code: '101001',
            account_name: 'الصندوق الرئيسي بالريال السعودي',
            description: 'إثبات مبيعات نقدية يومية للفرع',
            debit: '5000.00',
            credit: '0.00'
          },
          {
            date: '2026-03-01',
            entry_num: 'JV-1001',
            account_code: '401002',
            account_name: 'إيرادات المبيعات العامة',
            description: 'إثبات مبيعات نقدية يومية للفرع',
            debit: '0.00',
            credit: '5000.00'
          }
        ],
        branchName: 'الفرع الرئيسي',
        userName: 'عبد الله المحاسب'
      };

      const buffer = await generatePDF('LedgerPdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid Receipt Voucher PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        voucher_number: 'RC-50021',
        date: '2026-07-08',
        payment_method: 'حوالة بنكية',
        party_name: 'شركة العليان التجارية',
        amount: '4500.00',
        description: 'دفعة تحت الحساب لقاء أعمال الصيانة والتشغيل الدورية',
        items: [
          {
            account_code: '102001',
            account_name: 'حساب بنك الراجحي الرئيسي',
            description: 'استلام حوالة بنكية بقيمة الصيانة',
            amount: '4500.00'
          }
        ],
        branchName: 'الفرع الرئيسي',
        userName: 'خالد عبد الله',
        isReceipt: true
      };

      const buffer = await generatePDF('VoucherPdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid Payment Voucher PDF buffer', async () => {
      const dto = {
        company: mockCompany,
        voucher_number: 'PV-3004',
        date: '2026-07-08',
        payment_method: 'نقدي',
        party_name: 'مؤسسة الرياض للأثاث',
        amount: '1200.00',
        description: 'شراء كراسي ومكاتب إدارية إضافية لقسم المبيعات الجديد',
        items: [
          {
            account_code: '120401',
            account_name: 'مصاريف الأثاث والمعدات المكتبية',
            description: 'شراء كراسي مبيعات',
            amount: '1200.00'
          }
        ],
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
