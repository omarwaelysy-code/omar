// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/env';
import pool from '../lib/postgres';
import { authenticateToken } from '../lib/auth-middleware';
import * as pdfGenModule from '../lib/pdf-generator';
const { generatePDF } = pdfGenModule;

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

    it('should generate a valid thermal receipt invoice PDF buffer (80mm) with dynamic QR code', async () => {
      const dto = {
        company: mockCompany,
        invoice_number: 'INV-THERM-80',
        date: '2026-07-08',
        payment_method: 'مدى',
        customer_name: 'زبون نقدي سريع',
        items: [
          {
            product_name: 'كولا علبة صغير بارد',
            quantity: '3',
            total: '7.50'
          },
          {
            product_name: 'سندوتش جبنة شيدر لذيذ',
            quantity: '1',
            total: '12.00'
          }
        ],
        subtotal: '19.50',
        vat_amount: '2.93',
        net_total: '22.43',
        isThermal: true,
        paperSize: 'thermal_80',
        qr_code: 'https://zatca.gov.sa/einvoicing/test-qr-data-cryptographic-payload',
        branchName: 'فرع السوبرماركت السريع',
        userName: 'كاشير 1'
      };

      const buffer = await generatePDF('SalesInvoicePdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid thermal receipt invoice PDF buffer (58mm)', async () => {
      const dto = {
        company: mockCompany,
        invoice_number: 'INV-THERM-58',
        date: '2026-07-08',
        payment_method: 'كاش',
        customer_name: 'زبون سريع',
        items: [
          {
            product_name: 'مياه معدنية 500 مل',
            quantity: '1',
            total: '1.50'
          }
        ],
        subtotal: '1.50',
        vat_amount: '0.23',
        net_total: '1.73',
        isThermal: true,
        paperSize: 'thermal_58',
        branchName: 'فرع المحطة',
        userName: 'كاشير 2'
      };

      const buffer = await generatePDF('SalesInvoicePdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('should generate a valid PDF buffer using custom template layout elements and columns', async () => {
      const customLayout = {
        header: [
          { type: 'text', x: 10, y: 10, width: 100, height: 10, properties: { text: 'عنوان فاتورة مخصص جداً', fontSize: 16, bold: true, color: '#0f766e', align: 'right' } },
          { type: 'variable', binding: 'customer_name', x: 10, y: 25, width: 90, height: 8, properties: { fontSize: 11, bold: true, color: '#1e293b', align: 'right' } },
          { type: 'variable', binding: 'invoice_number', x: 110, y: 25, width: 90, height: 8, properties: { fontSize: 11, bold: true, color: '#475569', align: 'left' } }
        ],
        details: {
          columns: [
            { id: 'col1', field: 'product_code', label: 'رمز المنتج', width: 20 },
            { id: 'col2', field: 'product_name', label: 'اسم المنتج المخصص', width: 50 },
            { id: 'col3', field: 'quantity', label: 'الكمية المباعة', width: 15 },
            { id: 'col4', field: 'total', label: 'المبلغ الإجمالي', width: 15 }
          ]
        },
        footer: [
          { type: 'text', x: 10, y: 10, width: 190, height: 10, properties: { text: 'شكراً لتعاملكم معنا - ملاحظات خاصة بالفاتورة', fontSize: 9, bold: false, color: '#64748b', align: 'center' } }
        ]
      };

      const dto = {
        company: mockCompany,
        invoice_number: 'INV-CUSTOM-001',
        date: '2026-08-07',
        payment_method: 'نقدي',
        customer_name: 'شركة العميل المخصص',
        items: [
          { product_code: 'PRD-CUST', product_name: 'منتج مخصص مع قالب خاص', quantity: '5', unit_price: '100.00', total: '500.00' }
        ],
        net_total: '500.00',
        customLayout: customLayout
      };

      const buffer = await generatePDF('SalesInvoicePdf', dto);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });
  });
});

describe('PDF Endpoint Security & Authentication (POST /api/erp/print/pdf)', () => {
  let app: express.Express;
  let server: Server;
  let endpointUrl: string;
  let generatePdfSpy: any;

  const validCompanyId = 'company-test-123';
  const alternateCompanyId = 'company-test-456';
  const userId = 'user-test-001';
  const userEmail = 'testuser@obrain.local';
  let currentDbSessionToken: string | null = 'active-session-token-abc';

  const validPayload = {
    templateName: 'SalesInvoicePdf',
    dto: {
      company: {
        name: 'شركة تجريبية لاختبار المصادقة',
        taxNumber: '310123456700003'
      },
      invoice_number: 'INV-AUTH-2026',
      date: '2026-07-08',
      payment_method: 'نقدي',
      customer_name: 'عميل الفحص الأمني',
      items: [
        {
          product_code: 'SEC-01',
          product_name: 'فحص الحماية الأمنية',
          quantity: '1',
          unit_price: '100.00',
          total: '100.00'
        }
      ],
      net_total: '100.00'
    }
  };

  const createToken = (sessionToken: string = 'active-session-token-abc', companyId: string = validCompanyId) => {
    return jwt.sign(
      {
        id: userId,
        email: userEmail,
        role: 'admin',
        company_id: companyId,
        session_token: sessionToken
      },
      getJwtSecret()
    );
  };

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: '50mb' }));

    // Replicate exact endpoint configuration from server.ts
    app.post("/api/erp/print/pdf", authenticateToken, async (req, res, next) => {
      const { templateName, dto } = req.body;
      try {
        if (!templateName || !dto) {
          return res.status(400).json({ error: "Missing templateName or dto" });
        }
        const pdfBuffer = await pdfGenModule.generatePDF(templateName, dto);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
        res.send(pdfBuffer);
      } catch (err: any) {
        res.status(500).json({
          error: "PDF Generation failed",
          message: "An error occurred while generating the document"
        });
      }
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        endpointUrl = `http://127.0.0.1:${addr.port}/api/erp/print/pdf`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    currentDbSessionToken = 'active-session-token-abc';
    generatePdfSpy = vi.spyOn(pdfGenModule, 'generatePDF');

    // Mock PostgreSQL pool queries for authenticateToken
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      const sqlStr = typeof sql === 'string' ? sql : ((sql && sql.text) || '');

      // User session validation query
      if (sqlStr.includes('active_session_token FROM users')) {
        if (currentDbSessionToken === null) {
          return { rows: [{ active_session_token: null }] } as any;
        }
        return { rows: [{ active_session_token: currentDbSessionToken }] } as any;
      }

      // User memberships query
      if (sqlStr.includes('FROM users') && sqlStr.includes('LOWER(email)')) {
        return {
          rows: [
            { id: userId, company_id: validCompanyId, role: 'admin', permissions: {}, role_ids: [] },
            { id: userId, company_id: alternateCompanyId, role: 'admin', permissions: {}, role_ids: [] }
          ]
        } as any;
      }

      // Licensing & Subscription query
      if (sqlStr.includes('companies')) {
        return {
          rows: [{
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }

      return { rows: [] } as any;
    });
  });

  // A. Valid JWT
  it('A. Valid JWT → 200, application/pdf, valid %PDF- (Real PDF generated)', async () => {
    const token = createToken('active-session-token-abc');
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(validPayload)
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="document.pdf"');

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(generatePdfSpy).toHaveBeenCalledTimes(1);
  });

  // B. No Authorization header
  it('B. No Authorization header → 401, generatePDF must NOT be called', async () => {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validPayload)
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied. No token provided');
    expect(generatePdfSpy).not.toHaveBeenCalled();
  });

  // C. Invalid JWT
  it('C. Invalid JWT → rejected (401/403), generatePDF must NOT be called', async () => {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer totally.invalid.fakejwttoken'
      },
      body: JSON.stringify(validPayload)
    });

    expect([401, 403]).toContain(res.status);
    expect(generatePdfSpy).not.toHaveBeenCalled();
  });

  // D. Expired/invalidated JWT
  it('D. Expired/invalidated JWT session → 401, generatePDF must NOT be called', async () => {
    const staleToken = createToken('old-expired-session-token');
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staleToken}`
      },
      body: JSON.stringify(validPayload)
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('SESSION_INVALIDATED');
    expect(generatePdfSpy).not.toHaveBeenCalled();
  });

  // E. Existing valid session after Company Switch
  it('E. Existing valid session after Company Switch → PDF continues to work (200, valid PDF)', async () => {
    const token = createToken('active-session-token-abc', validCompanyId);
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-company-id': alternateCompanyId
      },
      body: JSON.stringify(validPayload)
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(generatePdfSpy).toHaveBeenCalledTimes(1);
  });

  // F. After Logout
  it('F. After Logout → old token rejected with 401, generatePDF must NOT be called', async () => {
    const tokenBeforeLogout = createToken('active-session-token-abc');
    currentDbSessionToken = null;

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenBeforeLogout}`
      },
      body: JSON.stringify(validPayload)
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('SESSION_INVALIDATED');
    expect(generatePdfSpy).not.toHaveBeenCalled();
  });

  // G. After Password Change
  it('G. After Password Change → old token rejected (401), new valid token works (200, valid PDF)', async () => {
    const oldToken = createToken('session-token-before-password-change');
    currentDbSessionToken = 'session-token-after-password-change-new';
    const newToken = createToken('session-token-after-password-change-new');

    // 1. Old token rejected
    const resOld = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oldToken}`
      },
      body: JSON.stringify(validPayload)
    });
    expect(resOld.status).toBe(401);
    expect(generatePdfSpy).not.toHaveBeenCalled();

    // 2. Newly issued token succeeds with real PDF
    const resNew = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newToken}`
      },
      body: JSON.stringify(validPayload)
    });
    expect(resNew.status).toBe(200);
    expect(resNew.headers.get('content-type')).toBe('application/pdf');
    const buffer = Buffer.from(await resNew.arrayBuffer());
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(generatePdfSpy).toHaveBeenCalledTimes(1);
  });
});

