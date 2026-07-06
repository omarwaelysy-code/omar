import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PdfHeader } from './PdfHeader';
import { PdfFooter } from './PdfFooter';
import { PdfTable } from './PdfTable';
import { pdfStyles, pdfColors } from './PdfTheme';
import { shapeArabicText } from './PdfHelpers';

// ----------------------------------------------------
// DTO Definitions
// ----------------------------------------------------

export interface CompanyDTO {
  name: string;
  logoUrl?: string;
  taxNumber?: string;
  phone?: string;
}

export interface InvoiceItemDTO {
  product_code: string;
  product_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount: string;
  vat_amount: string;
  total: string;
}

export interface SalesInvoiceDTO {
  company: CompanyDTO;
  invoice_number: string;
  date: string;
  payment_method: string;
  customer_name: string;
  customer_tax_number?: string;
  customer_phone?: string;
  items: InvoiceItemDTO[];
  subtotal: string;
  discount_amount: string;
  vat_amount: string;
  net_total: string;
  userName?: string;
  branchName?: string;
}

export interface PurchaseInvoiceDTO {
  company: CompanyDTO;
  invoice_number: string;
  date: string;
  payment_method: string;
  supplier_name: string;
  supplier_tax_number?: string;
  supplier_phone?: string;
  items: InvoiceItemDTO[];
  subtotal: string;
  discount_amount: string;
  vat_amount: string;
  net_total: string;
  userName?: string;
  branchName?: string;
}

export interface StatementRowDTO {
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface CustomerStatementDTO {
  company: CompanyDTO;
  customer_name: string;
  date_from: string;
  date_to: string;
  starting_balance: string;
  ending_balance: string;
  rows: StatementRowDTO[];
  total_debit: string;
  total_credit: string;
  userName?: string;
  branchName?: string;
}

export interface SupplierStatementDTO {
  company: CompanyDTO;
  supplier_name: string;
  date_from: string;
  date_to: string;
  starting_balance: string;
  ending_balance: string;
  rows: StatementRowDTO[];
  total_debit: string;
  total_credit: string;
  userName?: string;
  branchName?: string;
}

export interface InventoryMovementRowDTO {
  date: string;
  type: string;
  doc_num: string;
  qty_in: string;
  qty_out: string;
  price: string;
  balance: string;
}

export interface InventoryCardDTO {
  company: CompanyDTO;
  product_code: string;
  product_name: string;
  barcode?: string;
  rows: InventoryMovementRowDTO[];
  total_in: string;
  total_out: string;
  balance: string;
  userName?: string;
  branchName?: string;
}

export interface GeneralLedgerRowDTO {
  date: string;
  entry_num: string;
  account_code: string;
  account_name: string;
  description: string;
  debit: string;
  credit: string;
}

export interface GeneralLedgerDTO {
  company: CompanyDTO;
  date_from: string;
  date_to: string;
  rows: GeneralLedgerRowDTO[];
  total_debit: string;
  total_credit: string;
  userName?: string;
  branchName?: string;
}

export interface TrialBalanceRowDTO {
  code: string;
  name: string;
  initial_debit: string;
  initial_credit: string;
  movement_debit: string;
  movement_credit: string;
  final_debit: string;
  final_credit: string;
}

export interface TrialBalanceDTO {
  company: CompanyDTO;
  date_from: string;
  date_to: string;
  rows: TrialBalanceRowDTO[];
  totals: {
    initial_debit: string;
    initial_credit: string;
    movement_debit: string;
    movement_credit: string;
    final_debit: string;
    final_credit: string;
  };
  userName?: string;
  branchName?: string;
}

export interface FinancialReportRowDTO {
  code: string;
  name: string;
  amount: string;
  isBold?: boolean;
}

export interface BalanceSheetDTO {
  company: CompanyDTO;
  date: string;
  assets: FinancialReportRowDTO[];
  liabilities: FinancialReportRowDTO[];
  totals: {
    assets: string;
    liabilities: string;
  };
  userName?: string;
  branchName?: string;
}

export interface IncomeStatementDTO {
  company: CompanyDTO;
  date_from: string;
  date_to: string;
  revenues: FinancialReportRowDTO[];
  expenses: FinancialReportRowDTO[];
  net_profit: string;
  userName?: string;
  branchName?: string;
}

export interface VoucherItemDTO {
  account_code: string;
  account_name: string;
  description: string;
  amount: string;
}

export interface VoucherDTO {
  company: CompanyDTO;
  voucher_number: string;
  date: string;
  payment_method: string;
  party_name: string; // Customer or Supplier
  amount: string;
  description: string;
  items: VoucherItemDTO[];
  userName?: string;
  branchName?: string;
  isReceipt: boolean; // Receipt or Payment
}

// ----------------------------------------------------
// PDF Layout Components
// ----------------------------------------------------

const localStyles = StyleSheet.create({
  metaGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: pdfColors.bgLight,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: pdfColors.border
  },
  metaCol: {
    flexDirection: 'column',
    gap: 4
  },
  metaLabel: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 8,
    color: pdfColors.textMuted
  },
  metaValue: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 9,
    fontWeight: 'bold',
    color: pdfColors.text
  },
  sectionTitle: {
    fontFamily: 'Noto Sans Arabic',
    fontSize: 10,
    fontWeight: 'bold',
    color: pdfColors.primaryDark,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.primary,
    paddingBottom: 2,
    width: '100%',
    textAlign: 'right'
  }
});

// 1. Sales Invoice
export const SalesInvoicePdf: React.FC<{ data: SalesInvoiceDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="فاتورة مبيعات"
        branchName={data.branchName}
        userName={data.userName}
        dateStr={data.date}
      />
      
      {/* Meta block */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('رقم الفاتورة:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.invoice_number)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('طريقة الدفع:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.payment_method)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('العميل:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.customer_name)}</Text>
          {data.customer_tax_number && (
            <Text style={localStyles.metaLabel}>{shapeArabicText(`الرقم الضريبي: ${data.customer_tax_number}`)}</Text>
          )}
        </View>
      </View>

      {/* Items Table */}
      <PdfTable
        columns={[
          { id: 'product_code', label: 'كود الصنف', width: 1.5 },
          { id: 'product_name', label: 'الصنف', width: 3, align: 'right' },
          { id: 'quantity', label: 'الكمية', width: 1 },
          { id: 'unit', label: 'الوحدة', width: 1 },
          { id: 'unit_price', label: 'السعر', width: 1 },
          { id: 'discount', label: 'الخصم', width: 1 },
          { id: 'vat_amount', label: 'الضريبة', width: 1 },
          { id: 'total', label: 'الإجمالي', width: 1.2 }
        ]}
        data={data.items}
      />

      {/* Totals */}
      <View style={pdfStyles.totalContainer}>
        <View style={pdfStyles.totalBox}>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('الإجمالي الفرعي:')}</Text>
            <Text style={pdfStyles.totalVal}>{shapeArabicText(data.subtotal)}</Text>
          </View>
          {Number(data.discount_amount) > 0 && (
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.totalLabel}>{shapeArabicText('الخصم:')}</Text>
              <Text style={pdfStyles.totalVal}>{shapeArabicText(data.discount_amount)}</Text>
            </View>
          )}
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('الضريبة (15%):')}</Text>
            <Text style={pdfStyles.totalVal}>{shapeArabicText(data.vat_amount)}</Text>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('الصافي النهائي:')}</Text>
            <Text style={pdfStyles.totalVal}>{shapeArabicText(data.net_total)}</Text>
          </View>
        </View>
      </View>

      {/* Signature fields */}
      <View style={pdfStyles.signatureContainer}>
        <View style={pdfStyles.signatureBox}>
          <View style={pdfStyles.signatureLine} />
          <Text style={pdfStyles.signatureTitle}>{shapeArabicText('توقيع المحاسب')}</Text>
        </View>
        <View style={pdfStyles.signatureBox}>
          <View style={pdfStyles.signatureLine} />
          <Text style={pdfStyles.signatureTitle}>{shapeArabicText('توقيع العميل')}</Text>
        </View>
      </View>

      <PdfFooter />
    </Page>
  </Document>
);

// 2. Purchase Invoice
export const PurchaseInvoicePdf: React.FC<{ data: PurchaseInvoiceDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="فاتورة مشتريات"
        branchName={data.branchName}
        userName={data.userName}
        dateStr={data.date}
      />
      
      {/* Meta block */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('رقم الفاتورة:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.invoice_number)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('طريقة الدفع:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.payment_method)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('المورد:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.supplier_name)}</Text>
          {data.supplier_tax_number && (
            <Text style={localStyles.metaLabel}>{shapeArabicText(`الرقم الضريبي: ${data.supplier_tax_number}`)}</Text>
          )}
        </View>
      </View>

      {/* Items Table */}
      <PdfTable
        columns={[
          { id: 'product_code', label: 'كود الصنف', width: 1.5 },
          { id: 'product_name', label: 'الصنف', width: 3, align: 'right' },
          { id: 'quantity', label: 'الكمية', width: 1 },
          { id: 'unit', label: 'الوحدة', width: 1 },
          { id: 'unit_price', label: 'السعر', width: 1 },
          { id: 'discount', label: 'الخصم', width: 1 },
          { id: 'vat_amount', label: 'الضريبة', width: 1 },
          { id: 'total', label: 'الإجمالي', width: 1.2 }
        ]}
        data={data.items}
      />

      {/* Totals */}
      <View style={pdfStyles.totalContainer}>
        <View style={pdfStyles.totalBox}>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('الإجمالي الفرعي:')}</Text>
            <Text style={pdfStyles.totalVal}>{shapeArabicText(data.subtotal)}</Text>
          </View>
          {Number(data.discount_amount) > 0 && (
            <View style={pdfStyles.totalRow}>
              <Text style={pdfStyles.totalLabel}>{shapeArabicText('الخصم:')}</Text>
              <Text style={pdfStyles.totalVal}>{shapeArabicText(data.discount_amount)}</Text>
            </View>
          )}
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('الضريبة (15%):')}</Text>
            <Text style={pdfStyles.totalVal}>{shapeArabicText(data.vat_amount)}</Text>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('الصافي النهائي:')}</Text>
            <Text style={pdfStyles.totalVal}>{shapeArabicText(data.net_total)}</Text>
          </View>
        </View>
      </View>

      {/* Signature fields */}
      <View style={pdfStyles.signatureContainer}>
        <View style={pdfStyles.signatureBox}>
          <View style={pdfStyles.signatureLine} />
          <Text style={pdfStyles.signatureTitle}>{shapeArabicText('توقيع المشتريات')}</Text>
        </View>
        <View style={pdfStyles.signatureBox}>
          <View style={pdfStyles.signatureLine} />
          <Text style={pdfStyles.signatureTitle}>{shapeArabicText('اعتماد الإدارة')}</Text>
        </View>
      </View>

      <PdfFooter />
    </Page>
  </Document>
);

// 3. Customer Statement
export const CustomerStatementPdf: React.FC<{ data: CustomerStatementDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="كشف حساب عميل"
        branchName={data.branchName}
        userName={data.userName}
      />

      {/* Meta block */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('اسم العميل:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.customer_name)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الفترة الزمنية:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(`من ${data.date_from} إلى ${data.date_to}`)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الرصيد الافتتاحي:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.starting_balance)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الرصيد الختامي:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.ending_balance)}</Text>
        </View>
      </View>

      {/* Statement Table */}
      <PdfTable
        columns={[
          { id: 'date', label: 'التاريخ', width: 1.5 },
          { id: 'reference', label: 'المرجع', width: 1.5 },
          { id: 'description', label: 'البيان', width: 4.5, align: 'right' },
          { id: 'debit', label: 'مدين', width: 1.2 },
          { id: 'credit', label: 'دائن', width: 1.2 },
          { id: 'balance', label: 'الرصيد', width: 1.5 }
        ]}
        data={data.rows}
        showTotals={true}
        totals={{
          debit: data.total_debit,
          credit: data.total_credit,
          balance: data.ending_balance
        }}
      />

      <PdfFooter />
    </Page>
  </Document>
);

// 4. Supplier Statement
export const SupplierStatementPdf: React.FC<{ data: SupplierStatementDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="كشف حساب مورد"
        branchName={data.branchName}
        userName={data.userName}
      />

      {/* Meta block */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('اسم المورد:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.supplier_name)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الفترة الزمنية:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(`من ${data.date_from} إلى ${data.date_to}`)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الرصيد الافتتاحي:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.starting_balance)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الرصيد الختامي:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.ending_balance)}</Text>
        </View>
      </View>

      {/* Statement Table */}
      <PdfTable
        columns={[
          { id: 'date', label: 'التاريخ', width: 1.5 },
          { id: 'reference', label: 'المرجع', width: 1.5 },
          { id: 'description', label: 'البيان', width: 4.5, align: 'right' },
          { id: 'debit', label: 'مدين', width: 1.2 },
          { id: 'credit', label: 'دائن', width: 1.2 },
          { id: 'balance', label: 'الرصيد', width: 1.5 }
        ]}
        data={data.rows}
        showTotals={true}
        totals={{
          debit: data.total_debit,
          credit: data.total_credit,
          balance: data.ending_balance
        }}
      />

      <PdfFooter />
    </Page>
  </Document>
);

// 5. General Ledger
export const LedgerPdf: React.FC<{ data: GeneralLedgerDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="دفتر الأستاذ العام"
        branchName={data.branchName}
        userName={data.userName}
      />

      {/* Filter Details */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الفترة المحددة:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(`من ${data.date_from} إلى ${data.date_to}`)}</Text>
        </View>
      </View>

      {/* Ledger Table */}
      <PdfTable
        columns={[
          { id: 'date', label: 'التاريخ', width: 1.2 },
          { id: 'entry_num', label: 'رقم القيد', width: 1.2 },
          { id: 'account_code', label: 'كود الحساب', width: 1.5 },
          { id: 'account_name', label: 'اسم الحساب', width: 3, align: 'right' },
          { id: 'description', label: 'شرح القيد', width: 4.5, align: 'right' },
          { id: 'debit', label: 'مدين', width: 1.2 },
          { id: 'credit', label: 'دائن', width: 1.2 }
        ]}
        data={data.rows}
        showTotals={true}
        totals={{
          debit: data.total_debit,
          credit: data.total_credit
        }}
      />

      <PdfFooter />
    </Page>
  </Document>
);

// 6. Trial Balance
export const TrialBalancePdf: React.FC<{ data: TrialBalanceDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="تقرير ميزان المراجعة"
        branchName={data.branchName}
        userName={data.userName}
      />

      {/* Meta */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الفترة المحددة:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(`من ${data.date_from} إلى ${data.date_to}`)}</Text>
        </View>
      </View>

      {/* Trial Balance Table */}
      <PdfTable
        columns={[
          { id: 'code', label: 'كود الحساب', width: 1.2 },
          { id: 'name', label: 'اسم الحساب', width: 2.5, align: 'right' },
          { id: 'initial_debit', label: 'رصيد أول مدين', width: 1.2 },
          { id: 'initial_credit', label: 'رصيد أول دائن', width: 1.2 },
          { id: 'movement_debit', label: 'حركة مدين', width: 1.2 },
          { id: 'movement_credit', label: 'حركة دائن', width: 1.2 },
          { id: 'final_debit', label: 'رصيد آخر مدين', width: 1.2 },
          { id: 'final_credit', label: 'رصيد آخر دائن', width: 1.2 }
        ]}
        data={data.rows}
        showTotals={true}
        totals={{
          initial_debit: data.totals.initial_debit,
          initial_credit: data.totals.initial_credit,
          movement_debit: data.totals.movement_debit,
          movement_credit: data.totals.movement_credit,
          final_debit: data.totals.final_debit,
          final_credit: data.totals.final_credit
        }}
      />

      <PdfFooter />
    </Page>
  </Document>
);

// 7. Balance Sheet (الميزانية العمومية)
export const BalanceSheetPdf: React.FC<{ data: BalanceSheetDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="الميزانية العمومية"
        branchName={data.branchName}
        userName={data.userName}
        dateStr={data.date}
      />

      {/* Assets / Liabilities Split Section */}
      <View style={{ flexDirection: 'row-reverse', gap: 15, marginTop: 10 }}>
        {/* Assets Side */}
        <View style={{ flex: 1 }}>
          <Text style={localStyles.sectionTitle}>{shapeArabicText('الأصول')}</Text>
          <PdfTable
            columns={[
              { id: 'name', label: 'اسم الحساب', width: 2.5, align: 'right' },
              { id: 'amount', label: 'المبلغ', width: 1.2 }
            ]}
            data={data.assets}
            showTotals={true}
            totals={{
              name: 'إجمالي الأصول',
              amount: data.totals.assets
            }}
          />
        </View>

        {/* Liabilities Side */}
        <View style={{ flex: 1 }}>
          <Text style={localStyles.sectionTitle}>{shapeArabicText('الالتزامات وحقوق الملكية')}</Text>
          <PdfTable
            columns={[
              { id: 'name', label: 'اسم الحساب', width: 2.5, align: 'right' },
              { id: 'amount', label: 'المبلغ', width: 1.2 }
            ]}
            data={data.liabilities}
            showTotals={true}
            totals={{
              name: 'إجمالي الالتزامات وحقوق الملكية',
              amount: data.totals.liabilities
            }}
          />
        </View>
      </View>

      <PdfFooter />
    </Page>
  </Document>
);

// 8. Income Statement (قائمة الدخل)
export const IncomeStatementPdf: React.FC<{ data: IncomeStatementDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="قائمة الدخل"
        branchName={data.branchName}
        userName={data.userName}
      />

      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الفترة الزمنية:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(`من ${data.date_from} إلى ${data.date_to}`)}</Text>
        </View>
      </View>

      {/* Revenues Section */}
      <Text style={localStyles.sectionTitle}>{shapeArabicText('الإيرادات')}</Text>
      <PdfTable
        columns={[
          { id: 'name', label: 'اسم الحساب', width: 3, align: 'right' },
          { id: 'amount', label: 'المبلغ', width: 1.5 }
        ]}
        data={data.revenues}
      />

      {/* Expenses Section */}
      <Text style={localStyles.sectionTitle}>{shapeArabicText('المصروفات والتكاليف')}</Text>
      <PdfTable
        columns={[
          { id: 'name', label: 'اسم الحساب', width: 3, align: 'right' },
          { id: 'amount', label: 'المبلغ', width: 1.5 }
        ]}
        data={data.expenses}
      />

      {/* Summary Box */}
      <View style={pdfStyles.totalContainer}>
        <View style={pdfStyles.totalBox}>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>{shapeArabicText('صافي الربح / الخسارة:')}</Text>
            <Text style={[pdfStyles.totalVal, Number(data.net_profit) < 0 ? { color: pdfColors.accentRed } : null]}>
              {shapeArabicText(data.net_profit)}
            </Text>
          </View>
        </View>
      </View>

      <PdfFooter />
    </Page>
  </Document>
);

// 9. Inventory Card (كارت حركة الصنف)
export const InventoryCardPdf: React.FC<{ data: InventoryCardDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle="كارت حركة الصنف"
        branchName={data.branchName}
        userName={data.userName}
      />

      {/* Item info */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('كود الصنف:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.product_code)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('اسم الصنف:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.product_name)}</Text>
        </View>
        {data.barcode && (
          <View style={localStyles.metaCol}>
            <Text style={localStyles.metaLabel}>{shapeArabicText('الباركود:')}</Text>
            <Text style={localStyles.metaValue}>{shapeArabicText(data.barcode)}</Text>
          </View>
        )}
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('الرصيد الحالي:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.balance)}</Text>
        </View>
      </View>

      {/* Movements Table */}
      <PdfTable
        columns={[
          { id: 'date', label: 'التاريخ', width: 1.5 },
          { id: 'type', label: 'نوع الحركة', width: 1.5, align: 'center' },
          { id: 'doc_num', label: 'رقم السند', width: 1.5 },
          { id: 'qty_in', label: 'الكمية الواردة', width: 1.2 },
          { id: 'qty_out', label: 'الكمية الصادرة', width: 1.2 },
          { id: 'price', label: 'سعر التكلفة', width: 1.2 },
          { id: 'balance', label: 'الرصيد التراكمي', width: 1.5 }
        ]}
        data={data.rows}
        showTotals={true}
        totals={{
          qty_in: data.total_in,
          qty_out: data.total_out,
          balance: data.balance
        }}
      />

      <PdfFooter />
    </Page>
  </Document>
);

// 10. Voucher (Receipt/Payment)
export const VoucherPdf: React.FC<{ data: VoucherDTO }> = ({ data }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <PdfHeader
        companyName={data.company.name}
        companyLogo={data.company.logoUrl}
        companyTaxNumber={data.company.taxNumber}
        companyPhone={data.company.phone}
        reportTitle={data.isReceipt ? 'سند قبض نقدي / بنكي' : 'سند صرف نقدي / بنكي'}
        branchName={data.branchName}
        userName={data.userName}
        dateStr={data.date}
      />

      {/* Meta block */}
      <View style={localStyles.metaGrid}>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('رقم السند:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.voucher_number)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('طريقة الدفع:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.payment_method)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText(data.isReceipt ? 'مستلم من:' : 'مدفوع لـ:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.party_name)}</Text>
        </View>
        <View style={localStyles.metaCol}>
          <Text style={localStyles.metaLabel}>{shapeArabicText('المبلغ الإجمالي:')}</Text>
          <Text style={localStyles.metaValue}>{shapeArabicText(data.amount)}</Text>
        </View>
      </View>

      {/* Description / Memo */}
      {data.description && (
        <View style={{ marginBottom: 15, padding: 8, borderWidth: 1, borderColor: pdfColors.border, borderRadius: 4, backgroundColor: pdfColors.bgLight }}>
          <Text style={{ fontSize: 8, color: pdfColors.textMuted, marginBottom: 2 }}>{shapeArabicText('البيان / الشرح:')}</Text>
          <Text style={{ fontSize: 9, color: pdfColors.text }}>{shapeArabicText(data.description)}</Text>
        </View>
      )}

      {/* Ledger Allocations Table */}
      {data.items && data.items.length > 0 && (
        <View>
          <Text style={localStyles.sectionTitle}>{shapeArabicText('توزيع الحسابات والتوجيه المحاسبي')}</Text>
          <PdfTable
            columns={[
              { id: 'account_code', label: 'كود الحساب', width: 1.5 },
              { id: 'account_name', label: 'اسم الحساب الموجه', width: 4, align: 'right' },
              { id: 'description', label: 'شرح السطر', width: 4.5, align: 'right' },
              { id: 'amount', label: 'المبلغ الموزع', width: 1.5 }
            ]}
            data={data.items}
            showTotals={true}
            totals={{
              amount: data.amount
            }}
          />
        </View>
      )}

      {/* Signature fields */}
      <View style={pdfStyles.signatureContainer}>
        <View style={pdfStyles.signatureBox}>
          <View style={pdfStyles.signatureLine} />
          <Text style={pdfStyles.signatureTitle}>{shapeArabicText('توقيع أمين الصندوق')}</Text>
        </View>
        <View style={pdfStyles.signatureBox}>
          <View style={pdfStyles.signatureLine} />
          <Text style={pdfStyles.signatureTitle}>{shapeArabicText('توقيع المستلم')}</Text>
        </View>
      </View>

      <PdfFooter />
    </Page>
  </Document>
);
