import { TemplateLayout, TemplateElement, DetailsColumn } from '../components/TemplateRenderer';

// Helper to create text element
const txt = (
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Partial<TemplateElement['properties']> = {}
): TemplateElement => ({
  id,
  type: 'text',
  x,
  y,
  width,
  height,
  properties: {
    text,
    fontFamily: 'Cairo',
    fontSize: 10,
    bold: false,
    align: 'right',
    color: '#0f172a',
    ...opts,
  },
});

// Helper to create variable element
const variable = (
  id: string,
  binding: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Partial<TemplateElement['properties']> = {}
): TemplateElement => ({
  id,
  type: 'variable',
  x,
  y,
  width,
  height,
  binding,
  properties: {
    fontFamily: 'Cairo',
    fontSize: 10,
    bold: true,
    align: 'right',
    color: '#0f172a',
    ...opts,
  },
});

// Helper to create rectangle element
const rect = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: Partial<TemplateElement['properties']> = {}
): TemplateElement => ({
  id,
  type: 'rectangle',
  x,
  y,
  width,
  height,
  properties: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 6,
    ...opts,
  },
});

// Helper to create line element
const line = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number = 1,
  borderColor: string = '#cbd5e1',
  borderWidth: number = 1
): TemplateElement => ({
  id,
  type: 'line',
  x,
  y,
  width,
  height,
  properties: {
    borderColor,
    borderWidth,
  },
});

// Helper to create 4-signature footer (fits within 190mm printable width: x from 6 to 184)
const buildFourSignaturesFooter = (
  sig1Right: string,
  sig2MidRight: string,
  sig3MidLeft: string,
  sig4Left: string,
  accentColor: string = '#0f172a',
  lineColor: string = '#cbd5e1'
): TemplateElement[] => [
  line('footer-top-div', 6, 3, 178, 1, lineColor, 1),
  // Signature 1 (Rightmost)
  txt('sig-1-label', sig1Right, 141, 7, 42, 6, { fontSize: 9.5, bold: true, align: 'center', color: accentColor }),
  line('sig-1-line', 143, 24, 38, 1, lineColor, 1),
  // Signature 2 (Middle-Right)
  txt('sig-2-label', sig2MidRight, 96, 7, 42, 6, { fontSize: 9.5, bold: true, align: 'center', color: accentColor }),
  line('sig-2-line', 98, 24, 38, 1, lineColor, 1),
  // Signature 3 (Middle-Left)
  txt('sig-3-label', sig3MidLeft, 51, 7, 42, 6, { fontSize: 9.5, bold: true, align: 'center', color: accentColor }),
  line('sig-3-line', 53, 24, 38, 1, lineColor, 1),
  // Signature 4 (Leftmost)
  txt('sig-4-label', sig4Left, 6, 7, 42, 6, { fontSize: 9.5, bold: true, align: 'center', color: accentColor }),
  line('sig-4-line', 8, 24, 38, 1, lineColor, 1),
  // Bottom system stamp
  variable('footer-comp-name', 'company_name', 120, 29, 64, 5, { fontSize: 8, bold: true, align: 'right', color: '#64748b' }),
  txt('footer-sys-note', 'تم الإصدار آلياً عبر نظام ERP', 6, 29, 75, 5, { fontSize: 8, bold: false, align: 'left', color: '#94a3b8' }),
];

// 1. Sales & Purchase Invoices / Orders / Returns / Imports / ETA Layout Builder
const buildCommercialInvoiceLayout = (
  titleAr: string,
  partyType: 'customer' | 'supplier',
  accentColor: string = '#059669',
  isEta: boolean = false
): TemplateLayout => {
  const partyLabel = partyType === 'customer' ? 'العميل :' : 'المورد :';
  const partyBinding = partyType === 'customer' ? 'customer_name' : 'supplier_name';
  const taxBinding = partyType === 'customer' ? 'customer_tax_number' : 'supplier_tax_number';

  const header: TemplateElement[] = [
    {
      id: 'comp-logo',
      type: 'logo',
      x: 8,
      y: 5,
      width: 36,
      height: 18,
      properties: { align: 'center' },
    },
    txt('doc-title', titleAr, 94, 5, 90, 10, {
      fontSize: 18,
      bold: true,
      align: 'right',
      color: '#0f172a',
    }),
    txt('doc-num-lbl', 'رقم المستند :', 154, 16, 30, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('doc-num-val', 'document_number', 110, 16, 43, 6, { fontSize: 10, bold: true, color: accentColor }),
    txt('doc-date-lbl', 'التاريخ :', 88, 16, 20, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('doc-date-val', 'date', 52, 16, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    line('top-divider', 6, 24, 178, 1, '#e2e8f0', 1),

    // Left Summary Box
    rect('summary-box', 8, 28, 74, 42, {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 6,
    }),
    txt('summary-title', 'ملخص المستند المالي', 12, 30, 66, 6, {
      fontSize: 10,
      bold: true,
      align: 'right',
      color: accentColor,
    }),
    txt('sub-lbl', 'الإجمالي الفرعي :', 46, 37, 32, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('sub-val', 'subtotal', 12, 37, 33, 5, { fontSize: 9, bold: true, align: 'left', color: '#0f172a' }),
    txt('disc-lbl', 'إجمالي الخصم :', 46, 43, 32, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('disc-val', 'discount_amount', 12, 43, 33, 5, { fontSize: 9, bold: true, align: 'left', color: '#dc2626' }),
    txt('vat-lbl', 'ضريبة القيمة المضافة :', 46, 49, 32, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('vat-val', 'vat_amount', 12, 49, 33, 5, { fontSize: 9, bold: true, align: 'left', color: '#0f172a' }),
    line('sum-line', 12, 56, 66, 1, '#cbd5e1', 1),
    txt('net-lbl', 'الصافي النهائي :', 46, 59, 32, 6, { fontSize: 10, bold: true, color: accentColor }),
    variable('net-val', 'net_total', 12, 59, 33, 6, { fontSize: 10.5, bold: true, align: 'left', color: accentColor }),

    // Right Party & Document Details Box
    rect('party-box', 86, 28, 98, 42, {
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      borderRadius: 6,
    }),
    txt('party-lbl', partyLabel, 154, 31, 26, 6, { fontSize: 10, bold: true, color: '#475569' }),
    variable('party-val', partyBinding, 90, 31, 63, 6, { fontSize: 10.5, bold: true, color: '#0f172a' }),
    txt('tax-lbl', 'الرقم الضريبي :', 154, 39, 26, 5, { fontSize: 9, bold: true, color: '#475569' }),
    variable('tax-val', taxBinding, 90, 39, 63, 5, { fontSize: 9, bold: true, color: '#334155' }),
    txt('pay-lbl', 'طريقة الدفع :', 154, 46, 26, 5, { fontSize: 9, bold: true, color: '#475569' }),
    variable('pay-val', 'payment_method', 90, 46, 63, 5, { fontSize: 9, bold: false, color: '#334155' }),
    txt('due-lbl', 'تاريخ الاستحقاق :', 154, 53, 26, 5, { fontSize: 9, bold: true, color: '#475569' }),
    variable('due-val', 'due_date', 90, 53, 63, 5, { fontSize: 9, bold: false, color: '#334155' }),
    txt('branch-lbl', 'الفرع / العملة :', 154, 60, 26, 5, { fontSize: 9, bold: true, color: '#475569' }),
    variable('branch-val', 'branch_name', 112, 60, 41, 5, { fontSize: 8.5, bold: false, color: '#64748b' }),
    variable('curr-val', 'currency_code', 90, 60, 20, 5, { fontSize: 8.5, bold: true, align: 'left', color: accentColor }),
    line('bottom-divider', 6, 73, 178, 1, '#cbd5e1', 1),
  ];

  if (isEta) {
    header.push({
      id: 'eta-qr',
      type: 'qr',
      x: 46,
      y: 4,
      width: 18,
      height: 18,
      binding: 'document_number',
      properties: {},
    });
  }

  const columns: DetailsColumn[] = [
    { id: 'product_code', label: 'كود الصنف', field: 'product_code', width: 12 },
    { id: 'product_name', label: 'اسم الصنف / البيان', field: 'product_name', width: 32 },
    { id: 'unit', label: 'الوحدة', field: 'unit', width: 8 },
    { id: 'quantity', label: 'الكمية', field: 'quantity', width: 9 },
    { id: 'unit_price', label: 'سعر الوحدة', field: 'unit_price', width: 11 },
    { id: 'discount', label: 'الخصم', field: 'discount', width: 8 },
    { id: 'vat_amount', label: 'الضريبة', field: 'vat_amount', width: 9 },
    { id: 'total', label: 'الإجمالي', field: 'total', width: 11 },
  ];

  return {
    headerHeight: 76,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      partyType === 'customer' ? 'توقيع العميل / المستلم' : 'توقيع المورد / المسلم',
      'مسؤول المبيعات / المشتريات',
      'توقيع المحاسب',
      'المدير المالي / الاعتماد',
      '#0f172a'
    ),
  };
};

// 2. Receipt & Payment Vouchers & Cash Transfers Layout Builder (Matches Screenshot 2: media_1793917546115_90522d8c.png)
const buildCashVoucherLayout = (
  docType: 'receipt_vouchers' | 'payment_vouchers' | 'cash_transfers'
): TemplateLayout => {
  const isReceipt = docType === 'receipt_vouchers';
  const isTransfer = docType === 'cash_transfers';

  const titleAr = isReceipt
    ? 'سند قبض من عميل / نقدي'
    : isTransfer
      ? 'سند تحويل نقدي بين الخزائن والبنوك'
      : 'سند صرف لمورد / نقدي';

  const themeBorder = isReceipt ? '#0d9488' : isTransfer ? '#0284c7' : '#e11d48';
  const themeBgLight = isReceipt ? '#f0fdfa' : isTransfer ? '#f0f9ff' : '#fff1f2';
  const themeTextDark = isReceipt ? '#0f766e' : isTransfer ? '#0369a1' : '#be123c';

  const row1Label = isReceipt
    ? 'استلمنا من السيد / السادة :'
    : isTransfer
      ? 'تحويل من حساب الخزينة / البنك :'
      : 'يصرف إلى السيد / السادة :';
  const row1Binding = isReceipt ? 'customer_name' : isTransfer ? 'from_account' : 'supplier_name';

  const row3Label = isTransfer ? 'إلى حساب الخزينة / البنك المستلم :' : 'نقداً / شيك / حساب رقم :';
  const row3Binding = isTransfer ? 'to_account' : 'payment_method';

  const header: TemplateElement[] = [
    // Outer teal/rose rounded frame matching Screenshot 2
    rect('voucher-outer-frame', 5, 3, 180, 106, {
      backgroundColor: '#ffffff',
      borderColor: themeBorder,
      borderWidth: 1.5,
      borderRadius: 10,
    }),
    // Top-left logo circle + logo
    {
      id: 'voucher-logo-circle',
      type: 'circle',
      x: 11,
      y: 7,
      width: 22,
      height: 22,
      properties: {
        backgroundColor: themeBgLight,
        borderColor: themeBorder,
        borderWidth: 1,
      },
    },
    {
      id: 'voucher-logo',
      type: 'logo',
      x: 13,
      y: 9,
      width: 18,
      height: 18,
      properties: { align: 'center' },
    },
    // Amount Badge Pill Box on top-left next to logo
    rect('voucher-amount-box', 37, 9, 54, 14, {
      backgroundColor: themeBgLight,
      borderColor: themeBorder,
      borderWidth: 1,
      borderRadius: 8,
    }),
    txt('voucher-amt-lbl', 'المبلغ:', 74, 12, 14, 8, {
      fontSize: 9,
      bold: true,
      align: 'right',
      color: '#64748b',
    }),
    variable('voucher-amt-val', 'net_total', 50, 12, 23, 8, {
      fontSize: 12,
      bold: true,
      align: 'center',
      color: themeTextDark,
    }),
    variable('voucher-curr-val', 'currency_code', 39, 12, 11, 8, {
      fontSize: 8.5,
      bold: true,
      align: 'left',
      color: '#64748b',
    }),

    // Title & Voucher No / Date on top-right
    txt('voucher-title', titleAr, 94, 7, 84, 10, {
      fontSize: 17,
      bold: true,
      align: 'right',
      color: themeTextDark,
    }),
    txt('voucher-no-lbl', 'رقم:', 166, 18, 12, 6, { fontSize: 9.5, bold: true, color: '#334155' }),
    variable('voucher-no-val', 'document_number', 130, 18, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    txt('voucher-date-lbl', 'التاريخ:', 114, 18, 14, 6, { fontSize: 9.5, bold: true, color: '#334155' }),
    variable('voucher-date-val', 'date', 92, 18, 22, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),

    // Horizontal teal divider under header top
    line('voucher-top-line', 12, 31, 166, 1, themeBorder, 1),

    // Row 1: استلمنا من السيد / السادة :
    txt('v-row1-lbl', row1Label, 134, 36, 44, 8, { fontSize: 10.5, bold: true, align: 'right', color: themeTextDark }),
    rect('v-row1-box', 14, 36, 118, 9, { backgroundColor: '#f8fafc', borderColor: themeBorder, borderWidth: 1, borderRadius: 4 }),
    variable('v-row1-val', row1Binding, 18, 37, 110, 7, { fontSize: 10.5, bold: true, align: 'right', color: '#0f172a' }),

    // Row 2: مبلغ وقدره :
    txt('v-row2-lbl', 'مبلغ وقدره :', 134, 52, 44, 8, { fontSize: 10.5, bold: true, align: 'right', color: themeTextDark }),
    rect('v-row2-box', 14, 52, 118, 9, { backgroundColor: '#f8fafc', borderColor: themeBorder, borderWidth: 1, borderRadius: 4 }),
    variable('v-row2-val', 'amount_in_words', 18, 53, 110, 7, { fontSize: 10, bold: true, align: 'right', color: '#0f172a' }),

    // Row 3: نقداً / شيك رقم :
    txt('v-row3-lbl', row3Label, 134, 68, 44, 8, { fontSize: 10.5, bold: true, align: 'right', color: themeTextDark }),
    rect('v-row3-box', 14, 68, 118, 9, { backgroundColor: '#f8fafc', borderColor: themeBorder, borderWidth: 1, borderRadius: 4 }),
    variable('v-row3-val', row3Binding, 18, 69, 110, 7, { fontSize: 10, bold: true, align: 'right', color: '#0f172a' }),

    // Row 4: وذلك قيمة :
    txt('v-row4-lbl', 'وذلك قيمة / البيان :', 134, 84, 44, 8, { fontSize: 10.5, bold: true, align: 'right', color: themeTextDark }),
    rect('v-row4-box', 14, 84, 118, 9, { backgroundColor: '#f8fafc', borderColor: themeBorder, borderWidth: 1, borderRadius: 4 }),
    variable('v-row4-val', 'description', 18, 85, 110, 7, { fontSize: 10, bold: true, align: 'right', color: '#0f172a' }),
  ];

  const columns: DetailsColumn[] = [
    { id: 'account_code', label: 'كود الحساب / المرجع', field: 'product_code', width: 18 },
    { id: 'account_name', label: 'النوع / الحساب الموجه', field: 'product_name', width: 34 },
    { id: 'description', label: 'البيان والتفاصيل', field: 'description', width: 32 },
    { id: 'total', label: 'المبلغ', field: 'total', width: 16 },
  ];

  return {
    headerHeight: 112,
    footerHeight: 38,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: themeBgLight,
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      isReceipt ? 'المستلم (المحصل)' : 'المستفيد (المستلم)',
      'أمين الخزينة / الصراف',
      'المحاسب',
      'المدير المالي / الاعتماد',
      themeTextDark,
      themeBorder
    ),
  };
};

// 3. Bank Cheque & Cheque Operations Layout Builder (Matches Screenshot 3: media_1793917940298_692284e0.jpg)
const buildChequeLayout = (
  docType:
    | 'issue_supplier_cheque'
    | 'issue_other_cheque'
    | 'issued_cheque_operations'
    | 'receive_customer_cheque'
    | 'receive_other_cheque'
    | 'received_cheque_operations'
): TemplateLayout => {
  const isIssued = docType.startsWith('issue');
  const titlesMap: Record<string, string> = {
    issue_supplier_cheque: 'مستند تحرير شيك مورد صادر',
    issue_other_cheque: 'مستند تحرير شيك صادر لجهة أخرى',
    issued_cheque_operations: 'إشعار حركة شيك صادر (صرف / تأجيل / ارتداد / إلغاء)',
    receive_customer_cheque: 'حافظة استلام شيك وارد من عميل',
    receive_other_cheque: 'حافظة استلام شيك وارد من جهة أخرى',
    received_cheque_operations: 'إشعار حركة شيك وارد (إيداع / تحصيل / تظهير / ارتداد)',
  };

  const payeeBinding = isIssued ? 'supplier_name' : 'customer_name';

  const header: TemplateElement[] = [
    // Top Header Bar above Cheque
    txt('chq-doc-title', titlesMap[docType] || 'مستند شيك بنكي', 92, 3, 92, 8, {
      fontSize: 14,
      bold: true,
      align: 'right',
      color: '#0f172a',
    }),
    txt('chq-serial-lbl', 'المسلسل التلقائي:', 60, 4, 28, 6, { fontSize: 9, bold: true, color: '#64748b' }),
    variable('chq-serial-val', 'document_number', 24, 4, 35, 6, { fontSize: 9.5, bold: true, color: '#059669' }),

    // Main Bank Cheque Visual Frame (matches Screenshot 3)
    rect('cheque-frame', 5, 13, 180, 72, {
      backgroundColor: '#fcfcf9',
      borderColor: '#cbd5e1',
      borderWidth: 1.5,
      borderRadius: 8,
    }),

    // Top-Right of Cheque: Due Date & Cheque No
    rect('chq-date-box', 146, 16, 35, 11, { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4 }),
    txt('chq-date-lbl', 'تاريخ الاستحقاق DATE', 148, 17, 31, 4, { fontSize: 7, bold: true, align: 'center', color: '#64748b' }),
    variable('chq-date-val', 'due_date', 148, 21, 31, 5, { fontSize: 9, bold: true, align: 'center', color: '#0f172a' }),

    rect('chq-no-box', 108, 16, 35, 11, { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4 }),
    txt('chq-no-lbl', 'شيك رقم CHEQUE NO', 110, 17, 31, 4, { fontSize: 7, bold: true, align: 'center', color: '#64748b' }),
    variable('chq-no-val', 'cheque_number', 110, 21, 31, 5, { fontSize: 9.5, bold: true, align: 'center', color: '#0f172a' }),

    // Top-Middle Badges: تسطير // & غير قابل للتداول
    rect('chq-cross-badge', 80, 17, 25, 8, { backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 4 }),
    txt('chq-cross-txt', 'تسطير //', 81, 18, 23, 6, { fontSize: 8, bold: true, align: 'center', color: '#b45309' }),

    // Top-Left of Cheque: Bank Logo & Bank Name
    {
      id: 'chq-bank-logo',
      type: 'logo',
      x: 9,
      y: 16,
      width: 18,
      height: 11,
      properties: { align: 'center' },
    },
    variable('chq-bank-name', 'bank_name', 29, 17, 48, 9, {
      fontSize: 11,
      bold: true,
      align: 'left',
      color: '#0f172a',
    }),

    // Middle Row 1: ادفعوا بموجب هذا الشيك لأمر (Pay to the order of)
    txt('chq-pay-ar', 'ادفعوا بموجب هذا الشيك لأمر :', 138, 33, 43, 7, { fontSize: 9.5, bold: true, align: 'right', color: '#334155' }),
    rect('chq-pay-box', 42, 32, 95, 9, { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4 }),
    variable('chq-pay-val', payeeBinding, 45, 33, 89, 7, { fontSize: 10.5, bold: true, align: 'center', color: '#0f172a' }),
    txt('chq-pay-en', 'Against This Cheque Pay to the order of', 8, 33, 33, 7, { fontSize: 6.5, bold: true, align: 'left', color: '#64748b' }),

    // Middle Row 2: مبلغاً وقدره (The sum of) + Amount Box + Tafqeet
    txt('chq-sum-ar', 'مبلغاً وقدره :', 161, 46, 20, 7, { fontSize: 9.5, bold: true, align: 'right', color: '#334155' }),
    rect('chq-amt-num-box', 120, 45, 40, 10, { backgroundColor: '#f8fafc', borderColor: '#0f172a', borderWidth: 1.2, borderRadius: 4 }),
    variable('chq-amt-num-val', 'net_total', 131, 46, 27, 8, { fontSize: 11, bold: true, align: 'center', color: '#0f172a' }),
    variable('chq-amt-curr', 'currency_code', 121, 47, 10, 6, { fontSize: 8, bold: true, align: 'left', color: '#059669' }),

    rect('chq-tafqeet-box', 26, 45, 92, 10, { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4 }),
    variable('chq-tafqeet-val', 'amount_in_words', 29, 46, 86, 8, { fontSize: 9.5, bold: true, align: 'center', color: '#059669' }),
    txt('chq-sum-en', 'The sum of', 8, 47, 17, 6, { fontSize: 7, bold: true, align: 'left', color: '#64748b' }),

    // Bottom of Cheque: A/C PAYEE ONLY + MICR strip + Signature
    rect('chq-ac-payee', 147, 61, 34, 14, { backgroundColor: '#ffffff', borderColor: '#94a3b8', borderWidth: 1, borderRadius: 4 }),
    txt('chq-ac-txt', 'غير قابل للتداول A/C PAYEE ONLY', 148, 63, 32, 10, { fontSize: 7.5, bold: true, align: 'center', color: '#334155' }),

    rect('chq-micr-box', 64, 65, 80, 14, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4 }),
    txt('chq-micr-txt', 'نرجو عدم الكتابة أو وضع أختام على هذا الجزء السفلي (MICR)', 66, 68, 76, 8, { fontSize: 7.5, bold: true, align: 'center', color: '#64748b' }),

    txt('chq-sig-lbl', 'التوقيع المعتمد / Signature', 10, 61, 50, 5, { fontSize: 8.5, bold: true, align: 'center', color: '#334155' }),
    line('chq-sig-line', 12, 75, 46, 1, '#64748b', 1),

    // Accounting Routing Bar below Cheque (y: 88 to 112)
    rect('chq-acc-bar', 5, 88, 180, 22, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 6 }),
    txt('chq-acc-title', 'بيانات التوجيه المحاسبي والحركة :', 142, 90, 40, 5, { fontSize: 9, bold: true, color: '#059669' }),
    txt('chq-bank-acc-lbl', 'حساب البنك :', 162, 97, 20, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('chq-bank-acc-val', 'bank_account', 112, 97, 49, 5, { fontSize: 8.5, bold: true, color: '#0f172a' }),
    txt('chq-opp-acc-lbl', 'الحساب المقابل :', 88, 97, 22, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('chq-opp-acc-val', 'counter_account', 38, 97, 49, 5, { fontSize: 8.5, bold: true, color: '#0f172a' }),
    txt('chq-date-issue-lbl', 'التحرير:', 24, 97, 12, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('chq-date-issue-val', 'date', 7, 97, 17, 5, { fontSize: 8, bold: true, color: '#0f172a' }),
    txt('chq-desc-lbl', 'البيان / الغرض :', 160, 103, 22, 5, { fontSize: 8.5, bold: true, color: '#475569' }),
    variable('chq-desc-val', 'description', 8, 103, 151, 5, { fontSize: 8.5, bold: false, color: '#334155' }),
  ];

  const columns: DetailsColumn[] = [
    { id: 'cheque_number', label: 'رقم الشيك', field: 'product_code', width: 16 },
    { id: 'bank_name', label: 'البنك المسحوب عليه', field: 'product_name', width: 24 },
    { id: 'due_date', label: 'تاريخ الاستحقاق', field: 'due_date', width: 16 },
    { id: 'status', label: 'الحالة / التوجيه', field: 'unit', width: 14 },
    { id: 'description', label: 'البيان والملاحظات', field: 'description', width: 16 },
    { id: 'total', label: 'قيمة الشيك', field: 'total', width: 14 },
  ];

  return {
    headerHeight: 113,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      isIssued ? 'توقيع المستفيد / المستلم' : 'المسلم (العميل / المندوب)',
      'قسم الشيكات والبنوك',
      'المحاسب المختص',
      'المدير المالي / المفوض بالتوقيع',
      '#0f172a'
    ),
  };
};

// 4. Warehouse & Stock Operations Layout Builder
const buildWarehouseLayout = (
  docType:
    | 'goods_receipts'
    | 'warehouse_goods_receipts'
    | 'warehouse_transfers'
    | 'opening_stock_balances'
    | 'stock_adjustments'
): TemplateLayout => {
  const titlesMap: Record<string, string> = {
    goods_receipts: 'إذن استلام بضاعة من مورد',
    warehouse_goods_receipts: 'إذن إضافة واستلام مخزني',
    warehouse_transfers: 'سند تحويل بضاعة بين المخازن',
    opening_stock_balances: 'سند أرصدة أول المدة للمخزون',
    stock_adjustments: 'سند تسوية الأصناف وفروق الجرد',
  };

  const infoBoxElements: TemplateElement[] = [];

  if (docType === 'warehouse_transfers') {
    infoBoxElements.push(
      txt('wh-from-lbl', 'من المستودع (المحول منه) :', 142, 32, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('wh-from-val', 'from_warehouse', 95, 32, 46, 6, { fontSize: 10, bold: true, color: '#0f172a' }),
      txt('wh-to-lbl', 'إلى المستودع (المستلم) :', 52, 32, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('wh-to-val', 'to_warehouse', 10, 32, 41, 6, { fontSize: 10, bold: true, color: '#059669' }),
      txt('wh-notes-lbl', 'بيان وملاحظات التحويل :', 142, 42, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('wh-notes-val', 'description', 10, 42, 131, 6, { fontSize: 9.5, bold: false, color: '#334155' })
    );
  } else if (docType === 'opening_stock_balances') {
    infoBoxElements.push(
      txt('opb-dr-lbl', 'الحساب المدين (المخزون) :', 142, 32, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('opb-dr-val', 'debit_account', 95, 32, 46, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
      txt('opb-cr-lbl', 'الحساب الدائن (أول المدة) :', 52, 32, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('opb-cr-val', 'credit_account', 10, 32, 41, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
      txt('opb-je-lbl', 'رقم القيد المرتبط :', 142, 41, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('opb-je-val', 'original_entry_number', 95, 41, 46, 6, { fontSize: 9.5, bold: true, color: '#059669' }),
      txt('opb-tot-lbl', 'إجمالي قيمة المخزون :', 52, 41, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('opb-tot-val', 'net_total', 10, 41, 41, 6, { fontSize: 10, bold: true, color: '#059669' }),
      txt('opb-desc-lbl', 'البيان والملاحظات :', 142, 50, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('opb-desc-val', 'description', 10, 50, 131, 6, { fontSize: 9, bold: false, color: '#334155' })
    );
  } else if (docType === 'stock_adjustments') {
    infoBoxElements.push(
      txt('adj-acc-lbl', 'حساب التسوية المقابل :', 142, 32, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('adj-acc-val', 'adjustment_account', 95, 32, 46, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
      txt('adj-je-lbl', 'رقم القيد المرتبط :', 52, 32, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('adj-je-val', 'original_entry_number', 10, 32, 41, 6, { fontSize: 9.5, bold: true, color: '#059669' }),
      txt('adj-tot-lbl', 'إجمالي قيمة الفروق :', 142, 41, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('adj-tot-val', 'net_total', 95, 41, 46, 6, { fontSize: 10, bold: true, color: '#059669' }),
      txt('adj-desc-lbl', 'سبب التسوية / الملاحظات :', 142, 50, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('adj-desc-val', 'description', 10, 50, 131, 6, { fontSize: 9, bold: false, color: '#334155' })
    );
  } else {
    // goods_receipts / warehouse_goods_receipts
    infoBoxElements.push(
      txt('gr-sup-lbl', 'المورد / جهة التوريد :', 142, 32, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('gr-sup-val', 'supplier_name', 95, 32, 46, 6, { fontSize: 10, bold: true, color: '#0f172a' }),
      txt('gr-wh-lbl', 'المستودع المستلم :', 52, 32, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('gr-wh-val', 'warehouse_name', 10, 32, 41, 6, { fontSize: 10, bold: true, color: '#059669' }),
      txt('gr-ref-lbl', 'مرجع أمر الشراء / الفاتورة :', 142, 41, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('gr-ref-val', 'original_doc_number', 95, 41, 46, 6, { fontSize: 9.5, bold: true, color: '#334155' }),
      txt('gr-branch-lbl', 'الفرع :', 52, 41, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('gr-branch-val', 'branch_name', 10, 41, 41, 6, { fontSize: 9.5, bold: false, color: '#334155' }),
      txt('gr-desc-lbl', 'ملاحظات الاستلام والفحص :', 142, 50, 40, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
      variable('gr-desc-val', 'description', 10, 50, 131, 6, { fontSize: 9, bold: false, color: '#334155' })
    );
  }

  const header: TemplateElement[] = [
    {
      id: 'wh-logo',
      type: 'logo',
      x: 8,
      y: 5,
      width: 36,
      height: 18,
      properties: { align: 'center' },
    },
    txt('wh-title', titlesMap[docType], 88, 5, 96, 10, {
      fontSize: 17,
      bold: true,
      align: 'right',
      color: '#0f172a',
    }),
    txt('wh-num-lbl', 'رقم السند :', 156, 16, 26, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('wh-num-val', 'document_number', 110, 16, 45, 6, { fontSize: 10, bold: true, color: '#059669' }),
    txt('wh-date-lbl', 'التاريخ :', 88, 16, 20, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('wh-date-val', 'date', 52, 16, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    line('wh-top-div', 6, 24, 178, 1, '#e2e8f0', 1),
    rect('wh-info-box', 6, 28, 178, 32, {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 6,
    }),
    ...infoBoxElements,
  ];

  let columns: DetailsColumn[] = [];
  if (docType === 'warehouse_transfers') {
    columns = [
      { id: 'product_code', label: 'كود الصنف', field: 'product_code', width: 18 },
      { id: 'product_name', label: 'اسم الصنف', field: 'product_name', width: 46 },
      { id: 'unit', label: 'الوحدة', field: 'unit', width: 16 },
      { id: 'quantity', label: 'الكمية المحولة', field: 'quantity', width: 20 },
    ];
  } else if (docType === 'opening_stock_balances') {
    // Matches Screenshot 1 of Opening Stock Balance
    columns = [
      { id: 'product_code', label: 'كود الصنف', field: 'product_code', width: 14 },
      { id: 'product_name', label: 'الصنف', field: 'product_name', width: 32 },
      { id: 'warehouse_name', label: 'المستودع', field: 'warehouse_name', width: 18 },
      { id: 'quantity', label: 'الكمية', field: 'quantity', width: 12 },
      { id: 'unit_price', label: 'تكلفة الوحدة', field: 'unit_price', width: 12 },
      { id: 'total', label: 'الإجمالي', field: 'total', width: 12 },
    ];
  } else if (docType === 'stock_adjustments') {
    // Matches Screenshot 2 of Stock Adjustment
    columns = [
      { id: 'product_code', label: 'كود الصنف', field: 'product_code', width: 14 },
      { id: 'product_name', label: 'الصنف المراد تسويته', field: 'product_name', width: 32 },
      { id: 'warehouse_name', label: 'المستودع', field: 'warehouse_name', width: 18 },
      { id: 'quantity', label: 'فرق الكمية (+ / -)', field: 'quantity', width: 12 },
      { id: 'unit_price', label: 'تكلفة الوحدة', field: 'unit_price', width: 12 },
      { id: 'total', label: 'قيمة الفرق', field: 'total', width: 12 },
    ];
  } else {
    columns = [
      { id: 'product_code', label: 'كود الصنف', field: 'product_code', width: 16 },
      { id: 'product_name', label: 'اسم الصنف', field: 'product_name', width: 38 },
      { id: 'warehouse_name', label: 'المستودع', field: 'warehouse_name', width: 16 },
      { id: 'unit', label: 'الوحدة', field: 'unit', width: 12 },
      { id: 'quantity', label: 'الكمية المستلمة', field: 'quantity', width: 18 },
    ];
  }

  return {
    headerHeight: 64,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      'أمين المستودع المسلم',
      'أمين المستودع المستلم',
      'مسؤول الفحص / الجرد',
      'مدير المخازن / الاعتماد',
      '#0f172a'
    ),
  };
};

// 5. Customer & Supplier Discounts & Settlements Layout Builder
const buildSettlementOrDiscountLayout = (
  docType: 'customer_discounts' | 'customer_settlements' | 'supplier_discounts' | 'supplier_settlements'
): TemplateLayout => {
  const isCustomer = docType.startsWith('customer');
  const isSettlement = docType.endsWith('settlements');

  const titlesMap: Record<string, string> = {
    customer_discounts: 'إشعار خصم عميل (دائن / مسموح به)',
    customer_settlements: 'مذكرة تسوية ومقاصة حساب عميل',
    supplier_discounts: 'إشعار خصم مورد (مدين / خصم مكتسب)',
    supplier_settlements: 'مذكرة تسوية ومقاصة حساب مورد',
  };

  const partyLabel = isCustomer ? 'اسم العميل :' : 'اسم المورد :';
  const partyBinding = isCustomer ? 'customer_name' : 'supplier_name';

  const header: TemplateElement[] = [
    {
      id: 'set-logo',
      type: 'logo',
      x: 8,
      y: 5,
      width: 36,
      height: 18,
      properties: { align: 'center' },
    },
    txt('set-title', titlesMap[docType], 84, 5, 100, 10, {
      fontSize: 16.5,
      bold: true,
      align: 'right',
      color: '#0f172a',
    }),
    txt('set-num-lbl', 'رقم المستند :', 154, 16, 30, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('set-num-val', 'document_number', 110, 16, 43, 6, { fontSize: 10, bold: true, color: '#059669' }),
    txt('set-date-lbl', 'التاريخ :', 88, 16, 20, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('set-date-val', 'date', 52, 16, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    line('set-top-div', 6, 24, 178, 1, '#e2e8f0', 1),

    rect('set-info-box', 6, 28, 178, 30, {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 6,
    }),
    txt('set-party-lbl', partyLabel, 150, 32, 30, 6, { fontSize: 10, bold: true, color: '#475569' }),
    variable('set-party-val', partyBinding, 85, 32, 64, 6, { fontSize: 10.5, bold: true, color: '#0f172a' }),
    txt('set-amt-lbl', isSettlement ? 'إجمالي المبلغ المسوى :' : 'قيمة الخصم المعتمدة :', 45, 32, 36, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('set-amt-val', 'net_total', 10, 32, 34, 6, { fontSize: 11, bold: true, align: 'left', color: '#059669' }),
    txt('set-desc-lbl', 'البيان / سبب الحركة :', 150, 42, 30, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('set-desc-val', 'description', 10, 42, 139, 6, { fontSize: 9.5, bold: false, color: '#334155' }),
  ];

  const columns: DetailsColumn[] = isSettlement
    ? [
        { id: 'doc_no', label: 'رقم المستند المرجعي', field: 'product_code', width: 20 },
        { id: 'doc_type', label: 'نوع الحركة (مدين / دائن)', field: 'product_name', width: 28 },
        { id: 'doc_date', label: 'تاريخ المستند', field: 'unit', width: 16 },
        { id: 'orig_amt', label: 'قيمة المستند', field: 'unit_price', width: 18 },
        { id: 'settled_amt', label: 'المبلغ المسوى', field: 'total', width: 18 },
      ]
    : [
        { id: 'acc_code', label: 'رقم المرجع / الحساب', field: 'product_code', width: 20 },
        { id: 'acc_name', label: 'حساب الخصم / البيان', field: 'product_name', width: 42 },
        { id: 'notes', label: 'التفاصيل', field: 'description', width: 20 },
        { id: 'total', label: 'قيمة الخصم', field: 'total', width: 18 },
      ];

  return {
    headerHeight: 62,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      'محاسب العملاء / الموردين',
      'المراجع المالي',
      'رئيس الحسابات',
      'اعتماد المدير المالي',
      '#0f172a'
    ),
  };
};

// 6. General Ledger (Journal Entries & Reversal) Layout Builder
const buildJournalEntryLayout = (docType: 'journal_entries' | 'journal_reversal'): TemplateLayout => {
  const isReversal = docType === 'journal_reversal';
  const titleAr = isReversal ? 'سند عكس قيد يومية محاسبي' : 'سند قيد يومية عام';
  const accentColor = isReversal ? '#dc2626' : '#059669';

  const header: TemplateElement[] = [
    {
      id: 'je-logo',
      type: 'logo',
      x: 8,
      y: 5,
      width: 36,
      height: 18,
      properties: { align: 'center' },
    },
    txt('je-title', titleAr, 88, 5, 96, 10, {
      fontSize: 18,
      bold: true,
      align: 'right',
      color: isReversal ? '#991b1b' : '#0f172a',
    }),
    txt('je-num-lbl', 'رقم القيد :', 158, 16, 26, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('je-num-val', 'document_number', 112, 16, 45, 6, { fontSize: 10, bold: true, color: accentColor }),
    txt('je-date-lbl', 'التاريخ :', 88, 16, 20, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('je-date-val', 'date', 52, 16, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    line('je-top-div', 6, 24, 178, 1, '#e2e8f0', 1),

    rect('je-info-box', 6, 28, 178, 28, {
      backgroundColor: isReversal ? '#fef2f2' : '#f8fafc',
      borderColor: isReversal ? '#fecaca' : '#cbd5e1',
      borderWidth: 1,
      borderRadius: 6,
    }),
    txt('je-dr-lbl', 'إجمالي المدين :', 152, 32, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('je-dr-val', 'subtotal', 116, 32, 35, 6, { fontSize: 10.5, bold: true, color: '#059669' }),
    txt('je-cr-lbl', 'إجمالي الدائن :', 86, 32, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('je-cr-val', 'net_total', 50, 32, 35, 6, { fontSize: 10.5, bold: true, color: '#059669' }),
    txt('je-ref-lbl', 'المرجع :', 32, 32, 16, 6, { fontSize: 9, bold: true, color: '#475569' }),
    variable('je-ref-val', 'original_doc_number', 8, 32, 24, 6, { fontSize: 9, bold: true, color: '#334155' }),
    txt('je-desc-lbl', 'شرح وبيان القيد :', 152, 42, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('je-desc-val', 'description', 10, 42, 141, 6, { fontSize: 9.5, bold: false, color: '#334155' }),
  ];

  const columns: DetailsColumn[] = [
    { id: 'account_code', label: 'كود الحساب', field: 'product_code', width: 16 },
    { id: 'account_name', label: 'اسم الحساب المحاسبي', field: 'product_name', width: 32 },
    { id: 'description', label: 'البيان / شرح السطر', field: 'description', width: 28 },
    { id: 'debit', label: 'مدين (Debit)', field: 'debit', width: 12 },
    { id: 'credit', label: 'دائن (Credit)', field: 'credit', width: 12 },
  ];

  return {
    headerHeight: 60,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      'محاسب القيود (الإعداد)',
      'المراجع المالي',
      'رئيس الحسابات',
      'اعتماد المدير المالي',
      '#0f172a'
    ),
  };
};

// 7. Fixed Assets Operations Layout Builder
const buildFixedAssetLayout = (
  docType: 'fixed_asset_capitalization' | 'asset_depreciation' | 'fixed_asset_operations'
): TemplateLayout => {
  const titlesMap: Record<string, string> = {
    fixed_asset_capitalization: 'مستند تسجيل ورسملة أصل ثابت',
    asset_depreciation: 'كشف ومستند تشغيل الإهلاك الدوري للأصول',
    fixed_asset_operations: 'مستند حركة أصل ثابت (نقل / صيانة / تقييم / استبعاد)',
  };

  const header: TemplateElement[] = [
    {
      id: 'fa-logo',
      type: 'logo',
      x: 8,
      y: 5,
      width: 36,
      height: 18,
      properties: { align: 'center' },
    },
    txt('fa-title', titlesMap[docType], 80, 5, 104, 10, {
      fontSize: 16,
      bold: true,
      align: 'right',
      color: '#0f172a',
    }),
    txt('fa-num-lbl', 'رقم المستند :', 154, 16, 30, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('fa-num-val', 'document_number', 110, 16, 43, 6, { fontSize: 10, bold: true, color: '#059669' }),
    txt('fa-date-lbl', 'التاريخ :', 88, 16, 20, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('fa-date-val', 'date', 52, 16, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    line('fa-top-div', 6, 24, 178, 1, '#e2e8f0', 1),

    rect('fa-info-box', 6, 28, 178, 28, {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 6,
    }),
    txt('fa-branch-lbl', 'الفرع / الموقع :', 152, 32, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('fa-branch-val', 'branch_name', 102, 32, 49, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    txt('fa-tot-lbl', 'إجمالي القيمة المالية :', 60, 32, 38, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('fa-tot-val', 'net_total', 10, 32, 48, 6, { fontSize: 10.5, bold: true, color: '#059669' }),
    txt('fa-desc-lbl', 'بيان وتفاصيل الأصل :', 152, 42, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('fa-desc-val', 'description', 10, 42, 141, 6, { fontSize: 9.5, bold: false, color: '#334155' }),
  ];

  const columns: DetailsColumn[] = [
    { id: 'asset_code', label: 'كود الأصل', field: 'product_code', width: 16 },
    { id: 'asset_name', label: 'اسم الأصل الثابت', field: 'product_name', width: 32 },
    { id: 'category', label: 'التصنيف / الموقع', field: 'unit', width: 18 },
    { id: 'cost', label: 'التكلفة / القيمة', field: 'unit_price', width: 17 },
    { id: 'total', label: 'صافي القيمة / الإهلاك', field: 'total', width: 17 },
  ];

  return {
    headerHeight: 60,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      'مسؤول العهدة والأصول',
      'محاسب الأصول الثابتة',
      'المراجع الداخلي',
      'اعتماد الإدارة المالية',
      '#0f172a'
    ),
  };
};

// 8. Flexible Operations Layout Builder
const buildFlexibleOperationLayout = (): TemplateLayout => {
  const header: TemplateElement[] = [
    {
      id: 'flx-logo',
      type: 'logo',
      x: 8,
      y: 5,
      width: 36,
      height: 18,
      properties: { align: 'center' },
    },
    txt('flx-title', 'مستند عملية تشغيلية / مالية مخصصة', 84, 5, 100, 10, {
      fontSize: 17,
      bold: true,
      align: 'right',
      color: '#0f172a',
    }),
    txt('flx-num-lbl', 'رقم العملية :', 154, 16, 30, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('flx-num-val', 'document_number', 110, 16, 43, 6, { fontSize: 10, bold: true, color: '#059669' }),
    txt('flx-date-lbl', 'التاريخ :', 88, 16, 20, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('flx-date-val', 'date', 52, 16, 35, 6, { fontSize: 9.5, bold: true, color: '#0f172a' }),
    line('flx-top-div', 6, 24, 178, 1, '#e2e8f0', 1),

    rect('flx-info-box', 6, 28, 178, 28, {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 6,
    }),
    txt('flx-party-lbl', 'الطرف المرتبط :', 152, 32, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('flx-party-val', 'customer_name', 95, 32, 56, 6, { fontSize: 10, bold: true, color: '#0f172a' }),
    txt('flx-tot-lbl', 'إجمالي العملية :', 54, 32, 34, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('flx-tot-val', 'net_total', 10, 32, 43, 6, { fontSize: 10.5, bold: true, color: '#059669' }),
    txt('flx-desc-lbl', 'بيان وتفاصيل العملية :', 152, 42, 28, 6, { fontSize: 9.5, bold: true, color: '#475569' }),
    variable('flx-desc-val', 'description', 10, 42, 141, 6, { fontSize: 9.5, bold: false, color: '#334155' }),
  ];

  const columns: DetailsColumn[] = [
    { id: 'product_code', label: 'كود البند / الحساب', field: 'product_code', width: 16 },
    { id: 'product_name', label: 'اسم البند / البيان', field: 'product_name', width: 38 },
    { id: 'quantity', label: 'الكمية / العدد', field: 'quantity', width: 14 },
    { id: 'unit_price', label: 'السعر / القيمة', field: 'unit_price', width: 16 },
    { id: 'total', label: 'الإجمالي', field: 'total', width: 16 },
  ];

  return {
    headerHeight: 60,
    footerHeight: 36,
    watermarkEnabled: true,
    watermarkOpacity: 0.15,
    watermarkColorMode: 'color',
    watermarkRotation: 0,
    header,
    details: {
      columns,
      properties: {
        fontSize: 9.5,
        borderColor: '#cbd5e1',
        boldHeader: true,
        headerBgColor: '#f1f5f9',
        bodyBgColor: '#ffffff',
        borderWidth: 1,
        paddingX: 2,
        paddingY: 2,
        rowHeight: 8,
        fontFamily: 'Cairo',
      },
    },
    footer: buildFourSignaturesFooter(
      'منفذ العملية',
      'مشرف القسم',
      'المحاسب المختص',
      'اعتماد الإدارة',
      '#0f172a'
    ),
  };
};

/**
 * Main dispatcher returning the exact operation-matched TemplateLayout for all 33 document types
 */
export function getDefaultLayoutForDocumentType(docType: string): TemplateLayout {
  switch (docType) {
    // 1. Sales Menu
    case 'invoices':
      return buildCommercialInvoiceLayout('فاتورة مبيعات ضريبية', 'customer', '#059669');
    case 'sales_orders':
      return buildCommercialInvoiceLayout('أمر بيع / عرض سعر', 'customer', '#0284c7');
    case 'returns':
      return buildCommercialInvoiceLayout('إشعار مرتجع مبيعات', 'customer', '#dc2626');
    case 'sales_import':
      return buildCommercialInvoiceLayout('مستند مبيعات مستورد', 'customer', '#059669');
    case 'customer_discounts':
      return buildSettlementOrDiscountLayout('customer_discounts');
    case 'customer_settlements':
      return buildSettlementOrDiscountLayout('customer_settlements');

    // 2. Purchases Menu
    case 'purchase_invoices':
      return buildCommercialInvoiceLayout('فاتورة مشتريات', 'supplier', '#0f766e');
    case 'goods_receipts':
      return buildWarehouseLayout('goods_receipts');
    case 'purchase_orders':
      return buildCommercialInvoiceLayout('أمر شراء من مورد', 'supplier', '#0369a1');
    case 'purchase_returns':
      return buildCommercialInvoiceLayout('إشعار مرتجع مشتريات', 'supplier', '#e11d48');
    case 'purchases_import':
      return buildCommercialInvoiceLayout('مستند مشتريات مستورد', 'supplier', '#0f766e');
    case 'supplier_discounts':
      return buildSettlementOrDiscountLayout('supplier_discounts');
    case 'supplier_settlements':
      return buildSettlementOrDiscountLayout('supplier_settlements');

    // 3. Warehouses Menu
    case 'warehouse_goods_receipts':
      return buildWarehouseLayout('warehouse_goods_receipts');
    case 'warehouse_transfers':
      return buildWarehouseLayout('warehouse_transfers');
    case 'opening_stock_balances':
      return buildWarehouseLayout('opening_stock_balances');
    case 'stock_adjustments':
      return buildWarehouseLayout('stock_adjustments');

    // 4. Cash & Banks Menu
    case 'receipt_vouchers':
      return buildCashVoucherLayout('receipt_vouchers');
    case 'payment_vouchers':
      return buildCashVoucherLayout('payment_vouchers');
    case 'cash_transfers':
      return buildCashVoucherLayout('cash_transfers');

    // 5. Cheques Menu
    case 'issue_supplier_cheque':
      return buildChequeLayout('issue_supplier_cheque');
    case 'issue_other_cheque':
      return buildChequeLayout('issue_other_cheque');
    case 'issued_cheque_operations':
      return buildChequeLayout('issued_cheque_operations');
    case 'receive_customer_cheque':
      return buildChequeLayout('receive_customer_cheque');
    case 'receive_other_cheque':
      return buildChequeLayout('receive_other_cheque');
    case 'received_cheque_operations':
      return buildChequeLayout('received_cheque_operations');

    // 6. General Ledger Menu
    case 'journal_entries':
      return buildJournalEntryLayout('journal_entries');
    case 'journal_reversal':
      return buildJournalEntryLayout('journal_reversal');

    // 7. Fixed Assets Menu
    case 'fixed_asset_capitalization':
      return buildFixedAssetLayout('fixed_asset_capitalization');
    case 'asset_depreciation':
      return buildFixedAssetLayout('asset_depreciation');
    case 'fixed_asset_operations':
      return buildFixedAssetLayout('fixed_asset_operations');

    // 8. Flexible Operations Menu
    case 'flexible_operations':
      return buildFlexibleOperationLayout();

    // 9. ETA e-Invoicing Menu
    case 'eta_documents':
      return buildCommercialInvoiceLayout('وثيقة فاتورة إلكترونية معتمدة (ETA)', 'customer', '#059669', true);

    default:
      return buildCommercialInvoiceLayout('فاتورة مبيعات ضريبية', 'customer', '#059669');
  }
}

/**
 * Checks whether a system default template in DB still has the old blank/unconfigured layout
 * (e.g., empty header/footer or generic product_code columns on a voucher/cheque/journal template)
 */
export function isSystemTemplateLayoutOutdated(docType: string, rawLayout: any): boolean {
  if (!rawLayout) return true;
  let layout = rawLayout;
  if (typeof layout === 'string') {
    try {
      layout = JSON.parse(layout);
    } catch {
      return true;
    }
  }
  if (!Array.isArray(layout.header) || layout.header.length === 0) {
    return true;
  }
  if (!Array.isArray(layout.footer) || layout.footer.length === 0) {
    return true;
  }
  // Check if non-product document types accidentally have 'vat_rate' column from the old generic DEFAULT_LAYOUT
  const cols: any[] = layout.details?.columns || [];
  const hasVatRateCol = cols.some((c: any) => c.field === 'vat_rate');
  if (hasVatRateCol) {
    return true;
  }
  return false;
}

/**
 * Generates realistic operation-matched mock data for Live Preview and Designer Table Preview
 */
export function getPreviewDataForDocumentType(docType: string, company?: any, user?: any) {
  const base = {
    company_logo: company?.logo_url || '',
    company_name: company?.name || 'شركة النخبة للتجارة والأنظمة المتكاملة',
    branch_name: 'الفرع الرئيسي - القاهرة',
    user_name: user?.username || 'مدير النظام',
    date: '09/10/2026',
    due_date: '25/10/2026',
    time: '11:30 ص',
    currency_code: company?.currency || 'EGP',
    customer_name: 'شركة ABC للتوريدات والمقاولات',
    customer_tax_number: '31045982300003',
    supplier_name: 'مؤسسة التوريدات الهندسية الحديثة',
    supplier_tax_number: '41099283700003',
    payment_method: 'بنك مصر (قيد رقم: JE-2026-10-09-00003)',
    amount_in_words: 'فقط خمسمائة ألف جنيه مصري لا غير',
    description: 'تحصيل دفعات / تسوية حساب المستندات المستحقة',
    from_warehouse: 'المخزن الرئيسي - القاهرة',
    to_warehouse: 'مخزن فرع الإسكندرية',
    warehouse_name: 'المخزن الرئيسي',
    debit_account: '1115 - مخزون البضاعة الجاهزة',
    credit_account: '3101 - الأرصدة الافتتاحية (رأس المال)',
    adjustment_account: '5204 - حساب فروق وتسويات الجرد المخزني',
    from_account: '1101 - الخزينة الرئيسية للإدارة',
    to_account: '1102 - حساب بنك مصر الجاري (EGP)',
    bank_name: 'بنك مصر - BANQUE MISR',
    cheque_number: '00485921',
    bank_account: '110201 - بنك مصر (حساب جاري)',
    counter_account: '210201 - أوراق الدفع (شيكات صادرة)',
    original_doc_number: 'REF-2026-00105',
    original_entry_number: 'JE-2026-06-02-00005',
    document_number: 'INV-2026-000125',
    subtotal: 500000,
    discount_amount: 0,
    vat_amount: 70000,
    net_total: 500000,
    paid_amount: 500000,
    remaining_amount: 0,
    items: [] as any[],
  };

  if (docType === 'receipt_vouchers' || docType === 'payment_vouchers' || docType === 'cash_transfers') {
    const prefix = docType === 'receipt_vouchers' ? 'RV' : docType === 'payment_vouchers' ? 'PV' : 'CTR';
    return {
      ...base,
      document_number: `${prefix}-2026-10-000001`,
      net_total: 500000,
      subtotal: 500000,
      items: [
        {
          product_code: '1121-CUST-005',
          product_name: docType === 'receipt_vouchers' ? 'حساب العملاء - شركة ABC' : docType === 'payment_vouchers' ? 'حساب الموردين - مؤسسة التوريدات' : 'تحويل إلى بنك مصر الجاري',
          description: docType === 'receipt_vouchers' ? 'تحصيل دفعة نقدية / بنكية من العميل' : docType === 'payment_vouchers' ? 'سداد دفعة مستحقة للمورد' : 'تمويل الحساب البنكي من الخزينة',
          quantity: 1,
          unit: 'سند',
          unit_price: 500000,
          total: 500000,
        },
      ],
    };
  }

  if (docType.includes('cheque')) {
    return {
      ...base,
      document_number: 'CHQ-2026-06-000012',
      cheque_number: '98541203',
      due_date: '30/10/2026',
      net_total: 250000,
      subtotal: 250000,
      amount_in_words: 'فقط مائتان وخمسون ألف جنيه مصري لا غير',
      description: 'سداد مستحقات توريد بضاعة بموجب شيك بنكي مسطر',
      items: [
        {
          product_code: '98541203',
          product_name: 'بنك مصر - فرع المعاملات الدولية',
          due_date: '30/10/2026',
          unit: 'تحت التحصيل',
          description: 'شيك مسطر غير قابل للتداول',
          unit_price: 250000,
          total: 250000,
        },
      ],
    };
  }

  if (docType === 'opening_stock_balances' || docType === 'stock_adjustments') {
    const isAdj = docType === 'stock_adjustments';
    return {
      ...base,
      document_number: isAdj ? 'ADJ-2026-06-000002' : 'OPB-2026-06-000001',
      description: isAdj ? 'معالجة فروق جرد مستودعي لعام 2026' : 'إثبات أرصدة أول المدة للمخزون بالمستودعات',
      net_total: isAdj ? 105000 : 4450000,
      subtotal: isAdj ? 105000 : 4450000,
      items: [
        {
          product_code: 'CMD-0004',
          product_name: 'شاشة سامسونج الذكية 65 بوصة 4K',
          warehouse_name: 'المخزن الرئيسي',
          unit: 'عدد',
          quantity: isAdj ? 3 : 50,
          unit_price: isAdj ? 35000 : 25000,
          total: isAdj ? 105000 : 1250000,
        },
        {
          product_code: 'FG-0001',
          product_name: 'لابتوب HP EliteBook Core i7',
          warehouse_name: 'مخزن الإسكندرية',
          unit: 'عدد',
          quantity: isAdj ? -1 : 128,
          unit_price: 25000,
          total: isAdj ? -25000 : 3200000,
        },
      ],
    };
  }

  if (docType === 'warehouse_transfers' || docType === 'goods_receipts' || docType === 'warehouse_goods_receipts') {
    return {
      ...base,
      document_number: docType === 'warehouse_transfers' ? 'WTR-2026-000018' : 'GRN-2026-000042',
      description: 'تم فحص الأصناف واستلامها بحالة ممتازة ومطابقة للمواصفات',
      items: [
        {
          product_code: 'ITM-101',
          product_name: 'لابتوب HP ProBook 450 G10',
          warehouse_name: 'المخزن الرئيسي',
          unit: 'جهاز',
          quantity: 25,
          unit_price: 32000,
          total: 800000,
        },
        {
          product_code: 'ITM-204',
          product_name: 'شاشة عرض سامسونج 65 بوصة',
          warehouse_name: 'المخزن الرئيسي',
          unit: 'قطعة',
          quantity: 15,
          unit_price: 36000,
          total: 540000,
        },
      ],
    };
  }

  if (docType === 'journal_entries' || docType === 'journal_reversal') {
    return {
      ...base,
      document_number: docType === 'journal_reversal' ? 'REV-JE-2026-00009' : 'JE-2026-10-00045',
      description: 'قيد تسوية وإثبات العمليات المالية للفترة الحالية',
      subtotal: 150000,
      net_total: 150000,
      items: [
        {
          product_code: '110201',
          product_name: 'بنك مصر - الحساب الجاري بالعملة المحلية',
          description: 'إيداع نقدي وشيكات محصلة',
          debit: 150000,
          credit: 0,
          total: 150000,
        },
        {
          product_code: '112101',
          product_name: 'حساب العملاء التجاريين',
          description: 'سداد دفعة من حساب العميل',
          debit: 0,
          credit: 150000,
          total: 150000,
        },
      ],
    };
  }

  if (docType.includes('settlements') || docType.includes('discounts')) {
    return {
      ...base,
      document_number: docType.includes('settlements') ? 'STL-2026-000014' : 'DSC-2026-000008',
      description: 'تسوية ومقاصة الفواتير المفتوحة مع الدفعات والإشعارات الدائنة',
      net_total: 45000,
      subtotal: 45000,
      items: [
        {
          product_code: 'INV-2026-00102',
          product_name: 'فاتورة مبيعات آجلة (حركة مدينة)',
          unit: '01/10/2026',
          description: 'تسوية جزئية من الفاتورة',
          unit_price: 120000,
          total: 45000,
        },
        {
          product_code: 'RV-2026-00048',
          product_name: 'سند قبض دفعة مقدمة (حركة دائنة)',
          unit: '05/10/2026',
          description: 'ربط الدفعة بالفاتورة',
          unit_price: 45000,
          total: 45000,
        },
      ],
    };
  }

  if (docType.includes('asset')) {
    return {
      ...base,
      document_number: 'AST-2026-000011',
      description: 'إثبات رسملة وتشغيل إهلاك الأصول الثابتة للشركة',
      net_total: 650000,
      subtotal: 650000,
      items: [
        {
          product_code: 'FA-VEH-001',
          product_name: 'سيارة نقل وتوزيع مبردة - موديل 2026',
          unit: 'وسائل نقل وانتقال',
          quantity: 1,
          unit_price: 650000,
          total: 650000,
        },
      ],
    };
  }

  // Default: Commercial Sales/Purchase Invoices, Orders, Returns, ETA
  return {
    ...base,
    document_number: 'INV-2026-000412',
    subtotal: 100000,
    discount_amount: 5000,
    vat_amount: 13300,
    net_total: 108300,
    items: [
      {
        product_code: 'PRD-001',
        product_name: 'لابتوب أعمال احترافي HP EliteBook G10',
        barcode: '628100045120',
        unit: 'جهاز',
        quantity: 2,
        unit_price: 35000,
        discount: 2000,
        vat_rate: '14%',
        vat_amount: 9520,
        total: 77520,
      },
      {
        product_code: 'PRD-002',
        product_name: 'شاشة عرض ذكية سامسونج 65 بوصة 4K',
        barcode: '628100045199',
        unit: 'قطعة',
        quantity: 1,
        unit_price: 30000,
        discount: 3000,
        vat_rate: '14%',
        vat_amount: 3780,
        total: 30780,
      },
    ],
  };
}

