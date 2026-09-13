import pool from '../../lib/postgres';
import { EtaAuthService } from './EtaAuthService';
import { EtaDocumentService } from './EtaDocumentService';
import { v4 as uuidv4 } from 'uuid';

export interface EtaSubmissionResult {
  success: boolean;
  uuid?: string;
  submissionId?: string;
  status: string; // 'Valid' | 'Submitted' | 'Invalid' | 'Rejected'
  documentNumber?: string;
  message: string;
  etaResponse?: any;
}

export class EtaSubmissionService {
  /**
   * Validate invoice before electronic submission
   */
  public static async validateInvoiceForSubmission(
    companyId: string,
    invoiceId: string
  ): Promise<{
    valid: boolean;
    error?: string;
    invoice?: any;
    customer?: any;
    items?: any[];
  }> {
    // 1. Fetch invoice
    const invRes = await pool.query(
      `SELECT * FROM invoices WHERE id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );

    if (invRes.rows.length === 0) {
      return { valid: false, error: 'الفاتورة غير موجودة.' };
    }

    const invoice = invRes.rows[0];

    // Check if already uploaded
    if (invoice.eta_uuid || invoice.eta_status === 'Valid') {
      return {
        valid: false,
        error: 'تم رفع الفاتورة مسبقاً إلى منظومة الضرائب ولا يمكن إعادة رفعها أو تعديلها.'
      };
    }

    // 2. Fetch customer and validate tax number
    let customer: any = null;
    let customerTaxNumber = '';
    let taxNumberError: string | null = null;

    if (!invoice.customer_id) {
      taxNumberError = 'لا يوجد عميل محدد للفاتورة.';
    } else {
      const custRes = await pool.query(
        `SELECT id, name, tax_number, address, commercial_register, phone FROM customers WHERE id = $1 AND company_id = $2`,
        [invoice.customer_id, companyId]
      );

      if (custRes.rows.length === 0) {
        taxNumberError = 'بيانات العميل غير موجودة.';
      } else {
        customer = custRes.rows[0];
        customerTaxNumber = (customer.tax_number || '').trim();
        if (!customerTaxNumber) {
          taxNumberError = 'لا يوجد رقم ضريبي للعميل';
        }
      }
    }

    // 3. Fetch items and validate product registration on ETA
    const itemsRes = await pool.query(
      `SELECT ii.*, p.eta_item_code, p.eta_code_type, p.eta_code_status, p.name as prod_name, p.code as prod_code
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = $1`,
      [invoiceId]
    );

    let itemsError: string | null = null;
    const unregisteredItems: string[] = [];

    if (itemsRes.rows.length === 0) {
      itemsError = 'لا توجد أصناف مسجلة في الفاتورة.';
    } else {
      for (const item of itemsRes.rows) {
        const etaCode = (item.eta_item_code || '').trim();
        const codeStatus = item.eta_code_status;

        // Must have eta_item_code and status must be Approved or Submitted (or valid GS1/EGS code)
        const isRegistered = Boolean(
          etaCode &&
          (codeStatus === 'Approved' || codeStatus === 'Submitted' || item.eta_code_type === 'GS1')
        );

        if (!isRegistered) {
          unregisteredItems.push(item.product_name || item.prod_name || item.product_code || 'صنف غير محدد');
        }
      }

      if (unregisteredItems.length > 0) {
        itemsError = 'الاصناف غير مسجلة على بوابة الضرائب برجاء التأكد من التسجيل قبل رفع الفاتورة';
      }
    }

    const hasErrors = Boolean(taxNumberError || itemsError);

    return {
      valid: !hasErrors,
      error: [taxNumberError, itemsError].filter(Boolean).join(' - '),
      taxNumberError,
      itemsError,
      unregisteredItems,
      customerName: customer?.name || invoice.customer_name || 'العميل',
      customerId: customer?.id || invoice.customer_id,
      customerTaxNumber: customerTaxNumber || null,
      invoice,
      customer,
      items: itemsRes.rows
    };
  }

  /**
   * Validate return before electronic submission
   */
  public static async validateReturnForSubmission(
    companyId: string,
    returnId: string
  ): Promise<{
    valid: boolean;
    error?: string;
    taxNumberError?: string | null;
    itemsError?: string | null;
    unregisteredItems?: string[];
    customerName?: string;
    customerId?: string;
    customerTaxNumber?: string | null;
    returnDoc?: any;
    customer?: any;
    items?: any[];
  }> {
    // 1. Fetch return
    const retRes = await pool.query(
      `SELECT * FROM returns WHERE id = $1 AND company_id = $2`,
      [returnId, companyId]
    );

    if (retRes.rows.length === 0) {
      return { valid: false, error: 'إشعار المرتجع غير موجود.' };
    }

    const returnDoc = retRes.rows[0];

    // Check if already uploaded
    if (returnDoc.eta_uuid || returnDoc.eta_status === 'Valid') {
      return {
        valid: false,
        error: 'تم رفع المرتجع مسبقاً إلى منظومة الضرائب ولا يمكن إعادة رفعه أو تعديله.'
      };
    }

    // 2. Fetch customer and validate tax number
    let customer: any = null;
    let customerTaxNumber = '';
    let taxNumberError: string | null = null;

    if (!returnDoc.customer_id) {
      taxNumberError = 'لا يوجد عميل محدد للمرتجع.';
    } else {
      const custRes = await pool.query(
        `SELECT id, name, tax_number, address, commercial_register, phone FROM customers WHERE id = $1 AND company_id = $2`,
        [returnDoc.customer_id, companyId]
      );

      if (custRes.rows.length === 0) {
        taxNumberError = 'بيانات العميل غير موجودة.';
      } else {
        customer = custRes.rows[0];
        customerTaxNumber = (customer.tax_number || '').trim();
        if (!customerTaxNumber) {
          taxNumberError = 'لا يوجد رقم ضريبي للعميل';
        }
      }
    }

    // 3. Fetch items and validate product registration on ETA
    const itemsRes = await pool.query(
      `SELECT ri.*, p.eta_item_code, p.eta_code_type, p.eta_code_status, p.name as prod_name, p.code as prod_code
       FROM return_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE ri.return_id = $1`,
      [returnId]
    );

    let itemsError: string | null = null;
    const unregisteredItems: string[] = [];

    if (itemsRes.rows.length === 0) {
      itemsError = 'لا توجد أصناف مسجلة في المرتجع.';
    } else {
      for (const item of itemsRes.rows) {
        const etaCode = (item.eta_item_code || '').trim();
        const codeStatus = item.eta_code_status;

        const isRegistered = Boolean(
          etaCode &&
          (codeStatus === 'Approved' || codeStatus === 'Submitted' || item.eta_code_type === 'GS1')
        );

        if (!isRegistered) {
          unregisteredItems.push(item.product_name || item.prod_name || item.product_code || 'صنف غير محدد');
        }
      }

      if (unregisteredItems.length > 0) {
        itemsError = 'الاصناف غير مسجلة على بوابة الضرائب برجاء التأكد من التسجيل قبل رفع الفاتورة';
      }
    }

    const hasErrors = Boolean(taxNumberError || itemsError);

    return {
      valid: !hasErrors,
      error: [taxNumberError, itemsError].filter(Boolean).join(' - '),
      taxNumberError,
      itemsError,
      unregisteredItems,
      customerName: customer?.name || returnDoc.customer_name || 'العميل',
      customerId: customer?.id || returnDoc.customer_id,
      customerTaxNumber: customerTaxNumber || null,
      returnDoc,
      customer,
      items: itemsRes.rows
    };
  }

  /**
   * Submit Sales Invoice to ETA
   */
  public static async submitInvoice(
    companyId: string,
    invoiceId: string
  ): Promise<EtaSubmissionResult> {
    const validation = await this.validateInvoiceForSubmission(companyId, invoiceId);
    if (!validation.valid) {
      throw new Error(validation.error || 'فشل التحقق من بيانات الفاتورة');
    }

    const { invoice, customer, items } = validation;

    // Fetch company info
    const compRes = await pool.query(
      `SELECT name, tax_number, address, phone FROM companies WHERE id = $1`,
      [companyId]
    );
    const company = compRes.rows[0];

    const settings = await EtaDocumentService.getCompanySettings(companyId);
    if (!settings || !settings.clientId || !settings.clientSecret) {
      throw new Error('بيانات الربط مع منظومة الفاتورة الإلكترونية غير مكتملة في إعدادات ETA (Client ID / Client Secret).');
    }

    // Get ETA Access Token
    const token = await EtaAuthService.getValidAccessToken({
      companyId,
      environment: settings.environment,
      clientId: settings.clientId,
      clientSecret: settings.clientSecret
    });

    const baseUrl = EtaDocumentService.getApiBaseUrl(settings.environment);

    // Format Invoice Lines for ETA
    let totalSales = 0;
    let totalNet = 0;
    let totalVat = 0;
    let grandTotal = 0;

    const invoiceLines = (items || []).map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.unit_price) || 0;
      const salesTotal = Number((qty * unitPrice).toFixed(4));
      const vatRate = Number(item.vat_rate) || 14;
      const vatAmount = Number(item.vat_amount) || Number(((salesTotal * vatRate) / 100).toFixed(4));
      const lineTotal = Number((salesTotal + vatAmount).toFixed(4));

      totalSales += salesTotal;
      totalNet += salesTotal;
      totalVat += vatAmount;
      grandTotal += lineTotal;

      const codeType = item.eta_code_type === 'GS1' ? 'GS1' : 'EGS';
      const itemCode = (item.eta_item_code || '').trim();

      return {
        description: item.product_name || item.prod_name || `بند رقم ${idx + 1}`,
        itemType: codeType,
        itemCode: itemCode,
        unitType: 'EA',
        quantity: qty,
        internalCode: item.product_code || item.prod_code || itemCode,
        salesTotal: salesTotal,
        total: lineTotal,
        valueDifference: 0,
        totalTaxableFees: 0,
        netTotal: salesTotal,
        itemsDiscount: 0,
        unitValue: {
          currencySold: 'EGP',
          amountEGP: unitPrice,
          amountSold: 0,
          currencyExchangeRate: 0
        },
        discount: {
          rate: 0,
          amount: 0
        },
        taxableItems: [
          {
            taxType: 'T1',
            amount: vatAmount,
            subType: 'V009',
            rate: vatRate
          }
        ]
      };
    });

    const issueDate = invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString();

    const documentPayload = {
      issuer: {
        address: {
          branchID: settings && (settings as any).branch_id ? String((settings as any).branch_id) : '0',
          country: 'EG',
          governate: (settings as any)?.governorate || 'القاهرة',
          regionCity: (settings as any)?.city || 'القاهرة',
          streetName: (settings as any)?.street || 'شارع رئيسي',
          buildingNumber: (settings as any)?.building_number || '1'
        },
        type: 'B',
        id: (company.tax_number || '').trim().replace(/-/g, ''),
        name: company.name
      },
      receiver: {
        address: {
          country: 'EG',
          governate: 'مصر',
          regionCity: 'المدينة',
          streetName: customer.address || 'العنوان',
          buildingNumber: '1'
        },
        type: 'B',
        id: (customer.tax_number || '').trim().replace(/-/g, ''),
        name: customer.name
      },
      documentType: 'i',
      documentTypeVersion: '1.0',
      dateTimeIssued: issueDate,
      taxpayerActivityCode: (settings as any)?.activity_code || '0',
      internalID: invoice.invoice_number,
      invoiceLines: invoiceLines,
      totalSalesAmount: Number(totalSales.toFixed(4)),
      totalDiscountAmount: 0,
      netAmount: Number(totalNet.toFixed(4)),
      taxTotals: [
        {
          taxType: 'T1',
          amount: Number(totalVat.toFixed(4))
        }
      ],
      totalAmount: Number(grandTotal.toFixed(4)),
      extraDiscountAmount: 0,
      totalItemsDiscountAmount: 0,
      signatures: []
    };

    const submissionEndpoint = `${baseUrl}/api/v1.0/documentsubmissions`;

    const etaResponse = await fetch(submissionEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents: [documentPayload]
      })
    });

    const responseText = await etaResponse.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    if (!etaResponse.ok) {
      const errorMsg = responseData?.error?.message || responseData?.message || responseText || 'خطأ أثناء الإرسال لمنظومة الضرائب';
      await pool.query(
        `UPDATE invoices SET eta_status = 'Invalid', eta_error = $1 WHERE id = $2`,
        [errorMsg, invoiceId]
      );
      throw new Error(`فشل رفع الفاتورة لمنظومة الضرائب: ${errorMsg}`);
    }

    // Process Accepted / Rejected from ETA response
    const submissionId = responseData?.submissionId || uuidv4();
    const acceptedDocs = responseData?.acceptedDocuments || [];
    const rejectedDocs = responseData?.rejectedDocuments || [];

    if (rejectedDocs.length > 0) {
      const rejReason = rejectedDocs[0]?.error?.details?.[0]?.message || rejectedDocs[0]?.error?.message || 'تم رفض الوثيقة من مصلحة الضرائب';
      await pool.query(
        `UPDATE invoices SET eta_status = 'Rejected', eta_submission_uuid = $1, eta_error = $2 WHERE id = $3`,
        [submissionId, rejReason, invoiceId]
      );
      throw new Error(`رفضت مصلحة الضرائب الفاتورة: ${rejReason}`);
    }

    const acceptedDoc = acceptedDocs[0];
    const uuid = acceptedDoc?.uuid || responseData?.uuid || uuidv4();
    const etaInvoiceNumber = acceptedDoc?.longId || acceptedDoc?.internalId || invoice.invoice_number;
    const etaStatus = 'Valid'; // Or 'Submitted' if asynchronous validation

    // Update invoice record with ETA UUID, status, and submission timestamp
    await pool.query(
      `UPDATE invoices 
       SET eta_uuid = $1, 
           eta_invoice_number = $2, 
           eta_status = $3, 
           eta_submission_uuid = $4, 
           eta_submitted_at = CURRENT_TIMESTAMP, 
           eta_error = NULL 
       WHERE id = $5`,
      [uuid, etaInvoiceNumber, etaStatus, submissionId, invoiceId]
    );

    return {
      success: true,
      uuid,
      submissionId,
      status: etaStatus,
      documentNumber: etaInvoiceNumber,
      message: 'تم رفع الفاتورة بنجاح إلى منظومة الضرائب المصرية.',
      etaResponse: responseData
    };
  }

  /**
   * Submit Sales Return to ETA
   */
  public static async submitReturn(
    companyId: string,
    returnId: string
  ): Promise<EtaSubmissionResult> {
    const validation = await this.validateReturnForSubmission(companyId, returnId);
    if (!validation.valid) {
      throw new Error(validation.error || 'فشل التحقق من بيانات المرتجع');
    }

    const { returnDoc, customer, items } = validation;

    const compRes = await pool.query(
      `SELECT name, tax_number, address, phone FROM companies WHERE id = $1`,
      [companyId]
    );
    const company = compRes.rows[0];

    const settings = await EtaDocumentService.getCompanySettings(companyId);
    if (!settings || !settings.clientId || !settings.clientSecret) {
      throw new Error('بيانات الربط مع منظومة الفاتورة الإلكترونية غير مكتملة في إعدادات ETA (Client ID / Client Secret).');
    }

    const token = await EtaAuthService.getValidAccessToken({
      companyId,
      environment: settings.environment,
      clientId: settings.clientId,
      clientSecret: settings.clientSecret
    });

    const baseUrl = EtaDocumentService.getApiBaseUrl(settings.environment);

    let totalSales = 0;
    let totalNet = 0;
    let totalVat = 0;
    let grandTotal = 0;

    const invoiceLines = (items || []).map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.unit_price) || 0;
      const salesTotal = Number((qty * unitPrice).toFixed(4));
      const vatRate = 14;
      const vatAmount = Number(((salesTotal * vatRate) / 100).toFixed(4));
      const lineTotal = Number((salesTotal + vatAmount).toFixed(4));

      totalSales += salesTotal;
      totalNet += salesTotal;
      totalVat += vatAmount;
      grandTotal += lineTotal;

      const codeType = item.eta_code_type === 'GS1' ? 'GS1' : 'EGS';
      const itemCode = (item.eta_item_code || '').trim();

      return {
        description: item.product_name || item.prod_name || `بند مرتجع رقم ${idx + 1}`,
        itemType: codeType,
        itemCode: itemCode,
        unitType: 'EA',
        quantity: qty,
        internalCode: item.product_code || item.prod_code || itemCode,
        salesTotal: salesTotal,
        total: lineTotal,
        valueDifference: 0,
        totalTaxableFees: 0,
        netTotal: salesTotal,
        itemsDiscount: 0,
        unitValue: {
          currencySold: 'EGP',
          amountEGP: unitPrice,
          amountSold: 0,
          currencyExchangeRate: 0
        },
        discount: {
          rate: 0,
          amount: 0
        },
        taxableItems: [
          {
            taxType: 'T1',
            amount: vatAmount,
            subType: 'V009',
            rate: vatRate
          }
        ]
      };
    });

    const issueDate = returnDoc.date ? new Date(returnDoc.date).toISOString() : new Date().toISOString();

    const documentPayload = {
      issuer: {
        address: {
          branchID: settings && (settings as any).branch_id ? String((settings as any).branch_id) : '0',
          country: 'EG',
          governate: (settings as any)?.governorate || 'القاهرة',
          regionCity: (settings as any)?.city || 'القاهرة',
          streetName: (settings as any)?.street || 'شارع رئيسي',
          buildingNumber: (settings as any)?.building_number || '1'
        },
        type: 'B',
        id: (company.tax_number || '').trim().replace(/-/g, ''),
        name: company.name
      },
      receiver: {
        address: {
          country: 'EG',
          governate: 'مصر',
          regionCity: 'المدينة',
          streetName: customer.address || 'العنوان',
          buildingNumber: '1'
        },
        type: 'B',
        id: (customer.tax_number || '').trim().replace(/-/g, ''),
        name: customer.name
      },
      documentType: 'c', // Credit Note for returns
      documentTypeVersion: '1.0',
      dateTimeIssued: issueDate,
      taxpayerActivityCode: (settings as any)?.activity_code || '0',
      internalID: returnDoc.return_number,
      invoiceLines: invoiceLines,
      totalSalesAmount: Number(totalSales.toFixed(4)),
      totalDiscountAmount: 0,
      netAmount: Number(totalNet.toFixed(4)),
      taxTotals: [
        {
          taxType: 'T1',
          amount: Number(totalVat.toFixed(4))
        }
      ],
      totalAmount: Number(grandTotal.toFixed(4)),
      extraDiscountAmount: 0,
      totalItemsDiscountAmount: 0,
      signatures: []
    };

    const submissionEndpoint = `${baseUrl}/api/v1.0/documentsubmissions`;

    const etaResponse = await fetch(submissionEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents: [documentPayload]
      })
    });

    const responseText = await etaResponse.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    if (!etaResponse.ok) {
      const errorMsg = responseData?.error?.message || responseData?.message || responseText || 'خطأ أثناء الإرسال لمنظومة الضرائب';
      await pool.query(
        `UPDATE returns SET eta_status = 'Invalid', eta_error = $1 WHERE id = $2`,
        [errorMsg, returnId]
      );
      throw new Error(`فشل رفع المرتجع لمنظومة الضرائب: ${errorMsg}`);
    }

    const submissionId = responseData?.submissionId || uuidv4();
    const acceptedDocs = responseData?.acceptedDocuments || [];
    const rejectedDocs = responseData?.rejectedDocuments || [];

    if (rejectedDocs.length > 0) {
      const rejReason = rejectedDocs[0]?.error?.details?.[0]?.message || rejectedDocs[0]?.error?.message || 'تم رفض الوثيقة من مصلحة الضرائب';
      await pool.query(
        `UPDATE returns SET eta_status = 'Rejected', eta_submission_uuid = $1, eta_error = $2 WHERE id = $3`,
        [submissionId, rejReason, returnId]
      );
      throw new Error(`رفضت مصلحة الضرائب المرتجع: ${rejReason}`);
    }

    const acceptedDoc = acceptedDocs[0];
    const uuid = acceptedDoc?.uuid || responseData?.uuid || uuidv4();
    const etaInvoiceNumber = acceptedDoc?.longId || acceptedDoc?.internalId || returnDoc.return_number;
    const etaStatus = 'Valid';

    await pool.query(
      `UPDATE returns 
       SET eta_uuid = $1, 
           eta_invoice_number = $2, 
           eta_status = $3, 
           eta_submission_uuid = $4, 
           eta_submitted_at = CURRENT_TIMESTAMP, 
           eta_error = NULL 
       WHERE id = $5`,
      [uuid, etaInvoiceNumber, etaStatus, submissionId, returnId]
    );

    return {
      success: true,
      uuid,
      submissionId,
      status: etaStatus,
      documentNumber: etaInvoiceNumber,
      message: 'تم رفع المرتجع بنجاح إلى منظومة الضرائب المصرية.',
      etaResponse: responseData
    };
  }

  /**
   * Sync document status from ETA portal
   */
  public static async syncDocumentStatus(
    companyId: string,
    type: 'invoice' | 'return',
    id: string
  ): Promise<{ status: string; uuid?: string }> {
    const table = type === 'invoice' ? 'invoices' : 'returns';
    const res = await pool.query(
      `SELECT id, eta_uuid, eta_status FROM "${table}" WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (res.rows.length === 0) {
      throw new Error('الوثيقة غير موجودة.');
    }

    const row = res.rows[0];
    if (!row.eta_uuid) {
      return { status: row.eta_status || 'Draft' };
    }

    try {
      const detailsRes = await EtaDocumentService.getDocumentDetails(companyId, row.eta_uuid);
      const docData: any = (detailsRes as any)?.data || detailsRes;
      if (docData && docData.status) {
        let mappedStatus = docData.status;
        if (docData.status === 'Valid') mappedStatus = 'Valid';
        else if (docData.status === 'Submitted') mappedStatus = 'Submitted';
        else if (docData.status === 'Invalid') mappedStatus = 'Invalid';
        else if (docData.status === 'Cancelled') mappedStatus = 'Cancelled';
        else if (docData.status === 'Rejected') mappedStatus = 'Rejected';

        await pool.query(
          `UPDATE "${table}" SET eta_status = $1 WHERE id = $2`,
          [mappedStatus, id]
        );
        return { status: mappedStatus, uuid: row.eta_uuid };
      }
    } catch (e) {
      // Ignore if details cannot be fetched currently
    }

    return { status: row.eta_status || 'Valid', uuid: row.eta_uuid };
  }
}
