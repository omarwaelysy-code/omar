import React from 'react';
import { 
  TemplateElementDispatcher, 
  TableComponent, 
  evaluateConditionLocal 
} from './TemplateComponents';

export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'logo' | 'line' | 'rectangle' | 'circle' | 'barcode' | 'qr' | 'variable' | 'field' | 'signature' | 'page_number' | 'date' | 'time';
  x: number;
  y: number;
  width: number;
  height: number;
  properties: {
    text?: string;
    imageUrl?: string;
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    rotation?: number;
    opacity?: number;
    lineHeight?: number;
    locked?: boolean;
    hidden?: boolean;
    padding?: number;
    renderOnPage?: 'first' | 'last' | 'all' | 'not_first' | 'not_last';
    condition?: {
      enabled: boolean;
      field: string;
      operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty' | 'is_not_empty';
      value: string;
    }
  };
  binding?: string;
}

export interface DetailsColumn {
  id: string;
  label: string;
  field: string;
  width: number;
}

export interface TemplateLayout {
  headerHeight: number;
  footerHeight: number;
  bgImage?: string;
  watermarkText?: string;
  watermarkImage?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  header: TemplateElement[];
  details: {
    columns: DetailsColumn[];
    properties: {
      fontSize?: number;
      borderColor?: string;
      boldHeader?: boolean;
      headerBgColor?: string;
      bodyBgColor?: string;
      borderWidth?: number;
      paddingX?: number;
      paddingY?: number;
      fontFamily?: string;
      rowHeight?: number;
      showRowNumbers?: boolean;
      showTotals?: boolean;
    };
    elements?: TemplateElement[];
    height?: number;
  };
  footer: TemplateElement[];
}

export interface NormalizedDocument {
  company_logo?: string;
  company_name?: string;
  company_tax_number?: string;
  company_commercial_register?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  branch_name?: string;
  user_name?: string;
  date?: string;
  time?: string;
  current_date?: string;
  current_time?: string;
  document_number?: string;
  customer_name?: string;
  customer_tax_number?: string;
  customer_phone?: string;
  customer_address?: string;
  supplier_name?: string;
  supplier_tax_number?: string;
  supplier_phone?: string;
  supplier_address?: string;
  employee_name?: string;
  currency_code?: string;
  payment_method?: string;
  subtotal?: number;
  discount_amount?: number;
  vat_amount?: number;
  net_total?: number;
  paid_amount?: number;
  remaining_amount?: number;
  items: Array<{
    product_code: string;
    product_name: string;
    barcode: string;
    quantity: number;
    unit: string;
    unit_price: number;
    discount: number;
    vat_amount: number;
    vat_rate?: string;
    total: number;
  }>;
  dynamicFields?: { [key: string]: string };
}

export function normalizeDocumentData(
  type: string,
  data: any,
  company: any,
  currentUser: any
): NormalizedDocument {
  const doc: NormalizedDocument = {
    company_logo: company?.logo_url || '',
    company_name: company?.name || '',
    company_tax_number: company?.tax_number || '',
    company_commercial_register: company?.commercial_register || '',
    company_address: company?.address || '',
    company_phone: company?.phone || '',
    company_email: company?.email || '',
    branch_name: data?.branch_name || 'الفرع الرئيسي',
    user_name: currentUser?.username || data?.created_by || 'المشرف',
    date: data?.date || (data?.created_at ? new Date(data.created_at).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA')),
    time: data?.created_at ? new Date(data.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    current_date: new Date().toLocaleDateString('ar-SA'),
    current_time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    currency_code: company?.currency || data?.currency_code || 'SAR',
    payment_method: data?.payment_method_name || data?.payment_type || 'نقداً',
    items: [],
    dynamicFields: {},
    customer_tax_number: data.customer_tax_number || data.tax_number || '',
    customer_phone: data.customer_phone || data.customer_mobile || '',
    customer_address: data.customer_address || '',
    supplier_tax_number: data.supplier_tax_number || data.tax_number || '',
    supplier_phone: data.supplier_phone || data.supplier_mobile || '',
    supplier_address: data.supplier_address || '',
    employee_name: data.employee_name || data.created_by || 'المشرف'
  };

  if (type === 'invoices') {
    doc.document_number = data.invoice_number;
    doc.customer_name = data.customer_name;
    doc.subtotal = Number(data.subtotal || 0);
    doc.discount_amount = Number(data.discount_amount || 0);
    doc.vat_amount = Number(data.tax_amount || 0);
    doc.net_total = Number(data.total_amount || 0);
    doc.paid_amount = Number(data.total_amount || 0);
    doc.remaining_amount = 0;

    const itemsRaw = data.invoice_items || data.items || [];
    doc.items = itemsRaw.map((itm: any) => ({
      product_code: itm.product_code || itm.product_id || '-',
      product_name: itm.product_name || itm.description || '-',
      barcode: itm.barcode || '-',
      quantity: Number(itm.quantity || 0),
      unit: itm.unit || 'حبة',
      unit_price: Number(itm.unit_price || 0),
      discount: Number(itm.discount || 0),
      vat_amount: Number(itm.vat_amount || 0),
      vat_rate: itm.vat_rate !== undefined ? `% ${itm.vat_rate}` : (itm.tax_rate !== undefined ? `% ${itm.tax_rate}` : '% 14'),
      total: Number(itm.total || 0)
    }));
  } 
  else if (type === 'purchase_invoices') {
    doc.document_number = data.invoice_number;
    doc.supplier_name = data.supplier_name || data.supplier?.name || '';
    doc.customer_name = doc.supplier_name; // Fallback so customer_name binding resolves supplier name
    doc.supplier_tax_number = data.supplier_tax_number || data.tax_number || data.supplier?.tax_number || '';
    doc.customer_tax_number = doc.supplier_tax_number;
    doc.subtotal = Number(data.subtotal || 0);
    doc.discount_amount = Number(data.discount_amount || 0);
    doc.vat_amount = Number(data.tax_amount || 0);
    doc.net_total = Number(data.total_amount || 0);
    doc.paid_amount = Number(data.total_amount || 0);
    doc.remaining_amount = 0;

    const itemsRaw = data.purchase_invoice_items || data.items || [];
    doc.items = itemsRaw.map((itm: any) => ({
      product_code: itm.product_code || itm.product_id || '-',
      product_name: itm.product_name || itm.description || '-',
      barcode: itm.barcode || '-',
      quantity: Number(itm.quantity || 0),
      unit: itm.unit || 'حبة',
      unit_price: Number(itm.unit_price || 0),
      discount: Number(itm.discount || 0),
      vat_amount: Number(itm.vat_amount || 0),
      vat_rate: itm.vat_rate !== undefined ? `% ${itm.vat_rate}` : (itm.tax_rate !== undefined ? `% ${itm.tax_rate}` : '% 14'),
      total: Number(itm.total || 0)
    }));
  } 
  else if (type === 'returns' || type === 'purchase_returns') {
    doc.document_number = data.return_number;
    doc.customer_name = data.customer_name || data.supplier_name || '';
    doc.supplier_name = data.supplier_name || data.customer_name || '';
    doc.customer_tax_number = data.customer_tax_number || data.supplier_tax_number || data.tax_number || '';
    doc.supplier_tax_number = data.supplier_tax_number || data.customer_tax_number || data.tax_number || '';
    
    doc.subtotal = Number(data.subtotal || 0);
    doc.discount_amount = Number(data.discount_amount || data.discount || 0);
    doc.vat_amount = Number(data.tax_amount || data.tax || data.vat_amount || 0);
    doc.net_total = Number(data.total_amount || (doc.subtotal + doc.vat_amount - doc.discount_amount) || 0);
    doc.paid_amount = doc.net_total;
    doc.remaining_amount = 0;

    const itemsRaw = data.return_items || data.purchase_return_items || data.items || [];
    doc.items = itemsRaw.map((itm: any) => {
      const qty = Number(itm.quantity || 0);
      const price = Number(itm.unit_price || itm.price || 0);
      const total = Number(itm.total || (qty * price) || 0);
      const vatRateNum = Number(itm.vat_rate !== undefined && itm.vat_rate !== null ? itm.vat_rate : (itm.tax_rate !== undefined ? itm.tax_rate : 14));
      const vatAmt = Number((itm.vat_amount !== undefined && itm.vat_amount !== null && Number(itm.vat_amount) > 0) ? itm.vat_amount : ((total * vatRateNum) / 100));

      return {
        product_code: itm.product_code || itm.product_id || '-',
        product_name: itm.product_name || itm.description || '-',
        barcode: itm.barcode || '-',
        quantity: qty,
        unit: itm.unit || 'حبة',
        unit_price: price,
        discount: Number(itm.discount || 0),
        vat_amount: vatAmt,
        vat_rate: `% ${vatRateNum}`,
        total: total
      };
    });

    if (!doc.vat_amount && doc.items.length > 0) {
      doc.vat_amount = doc.items.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
    }
    if (!doc.subtotal && doc.items.length > 0) {
      doc.subtotal = doc.items.reduce((sum, item) => sum + (item.total || 0), 0);
    }
    if (doc.net_total === doc.subtotal && doc.vat_amount > 0) {
      doc.net_total = doc.subtotal + doc.vat_amount - doc.discount_amount;
    }
  } 
  else if (type === 'sales_orders' || type === 'purchase_orders') {
    doc.document_number = data.order_number;
    doc.customer_name = data.customer_name || '';
    doc.supplier_name = data.supplier_name || '';
    doc.subtotal = Number(data.subtotal || 0);
    doc.discount_amount = Number(data.discount_amount || 0);
    doc.vat_amount = Number(data.tax_amount || 0);
    doc.net_total = Number(data.total_amount || 0);
    doc.paid_amount = 0;
    doc.remaining_amount = Number(data.total_amount || 0);

    const itemsRaw = data.sales_order_items || data.purchase_order_items || data.items || [];
    doc.items = itemsRaw.map((itm: any) => ({
      product_code: itm.product_code || '-',
      product_name: itm.product_name || itm.description || '-',
      barcode: itm.barcode || '-',
      quantity: Number(itm.quantity || 0),
      unit: itm.unit || 'حبة',
      unit_price: Number(itm.unit_price || 0),
      discount: 0,
      vat_amount: 0,
      total: Number(itm.total || 0)
    }));
  } 
  else if (type === 'receipt_vouchers' || type === 'payment_vouchers') {
    doc.document_number = data.voucher_number;
    doc.customer_name = data.customer_name || '';
    doc.supplier_name = data.supplier_name || '';
    doc.subtotal = Number(data.amount || 0);
    doc.discount_amount = 0;
    doc.vat_amount = 0;
    doc.net_total = Number(data.amount || 0);
    doc.paid_amount = Number(data.amount || 0);
    doc.remaining_amount = 0;

    const itemsRaw = data.items || [];
    doc.items = itemsRaw.map((itm: any) => ({
      product_code: itm.account_id || '-',
      product_name: itm.account_name || itm.description || '-',
      barcode: '-',
      quantity: 1,
      unit: '-',
      unit_price: Number(itm.amount || 0),
      discount: 0,
      vat_amount: 0,
      total: Number(itm.amount || 0)
    }));
  } 
  else if (type === 'journal_entries') {
    doc.document_number = data.entry_number;
    doc.subtotal = Number(data.total_debit || 0);
    doc.discount_amount = 0;
    doc.vat_amount = 0;
    doc.net_total = Number(data.total_debit || 0);
    doc.paid_amount = Number(data.total_debit || 0);
    doc.remaining_amount = 0;

    const itemsRaw = data.journal_entry_lines || data.lines || [];
    doc.items = itemsRaw.map((itm: any) => ({
      product_code: itm.account_id || '-',
      product_name: itm.account_name || itm.description || '-',
      barcode: '-',
      quantity: 1,
      unit: '-',
      unit_price: Number(itm.debit > 0 ? itm.debit : itm.credit),
      discount: 0,
      vat_amount: 0,
      total: Number(itm.debit > 0 ? itm.debit : itm.credit)
    }));
  }

  // Bind dynamic operation fields values
  if (data?.dynamicFields) {
    doc.dynamicFields = data.dynamicFields;
  } else if (data?.field_values) {
    const fieldsMap: { [key: string]: string } = {};
    data.field_values.forEach((fv: any) => {
      if (fv.field_code) fieldsMap[fv.field_code] = fv.value;
    });
    doc.dynamicFields = fieldsMap;
  }

  return doc;
}

interface TemplateRendererProps {
  layout: TemplateLayout;
  data: NormalizedDocument;
  scale?: number;
  margin?: { top: number; bottom: number; left: number; right: number };
  width?: number; // mm
  height?: number; // mm (defaults to A4 A4 297mm)
  dir?: 'ltr' | 'rtl';
}

export function TemplateRenderer({
  layout,
  data,
  scale = 3.5,
  margin = { top: 10, bottom: 10, left: 10, right: 10 },
  width = 210,
  height = 297,
  dir = 'rtl'
}: TemplateRendererProps) {
  const printableWidth = width - margin.left - margin.right;
  const printableHeight = height - margin.top - margin.bottom;

  // Pagination Engine: Split items into pages
  const availableDetailsHeight = printableHeight - layout.headerHeight - layout.footerHeight;
  const rowHeight = layout.details?.properties?.rowHeight || 8;
  const tableHeaderHeight = 8;
  const maxRowsPerPage = Math.max(1, Math.floor((availableDetailsHeight - tableHeaderHeight) / rowHeight));

  const itemPages: any[][] = [];
  if (data.items.length === 0) {
    itemPages.push([]);
  } else {
    for (let i = 0; i < data.items.length; i += maxRowsPerPage) {
      itemPages.push(data.items.slice(i, i + maxRowsPerPage));
    }
  }

  const totalPagesCount = itemPages.length;

  const shouldRenderElement = (el: TemplateElement, pageIdx: number, totalPages: number) => {
    const renderOn = el.properties.renderOnPage || 'all';
    if (renderOn === 'first' && pageIdx !== 0) return false;
    if (renderOn === 'last' && pageIdx !== totalPages - 1) return false;
    if (renderOn === 'not_first' && pageIdx === 0) return false;
    if (renderOn === 'not_last' && pageIdx === totalPages - 1) return false;
    return true;
  };

  return (
    <div className="flex flex-col gap-6 no-print-gap bg-zinc-200 p-4">
      {itemPages.map((pageItems, pageIdx) => (
        <div
          key={pageIdx}
          className="bg-white relative shadow-xl text-zinc-900 overflow-hidden print-page"
          style={{
            width: `${printableWidth * scale}px`,
            height: `${printableHeight * scale}px`,
            paddingTop: `${margin.top * scale}px`,
            paddingBottom: `${margin.bottom * scale}px`,
            paddingLeft: `${margin.left * scale}px`,
            paddingRight: `${margin.right * scale}px`,
            backgroundImage: layout.bgImage ? `url(${layout.bgImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            pageBreakAfter: pageIdx < totalPagesCount - 1 ? 'always' : 'avoid'
          }}
          dir={dir}
        >
          {/* Watermark rendering */}
          {layout.watermarkText && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
              style={{
                opacity: layout.watermarkOpacity ?? 0.15,
                transform: `rotate(${layout.watermarkRotation ?? -45}deg)`,
                fontSize: '5vw',
                fontWeight: 'bold',
                color: '#000000',
              }}
            >
              {layout.watermarkText}
            </div>
          )}
          {layout.watermarkImage && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
              style={{
                opacity: layout.watermarkOpacity ?? 0.15,
              }}
            >
              <img
                src={layout.watermarkImage}
                alt="watermark"
                style={{
                  transform: `rotate(${layout.watermarkRotation ?? -45}deg)`,
                  maxWidth: '45%',
                  maxHeight: '45%'
                }}
              />
            </div>
          )}

          {/* Header section (fixed height) */}
          <div style={{ height: `${layout.headerHeight * scale}px`, width: '100%' }} className="relative z-10">
            {layout.header
              .filter(el => shouldRenderElement(el, pageIdx, totalPagesCount))
              .map(el => (
                <TemplateElementDispatcher
                  key={el.id}
                  el={el}
                  data={data}
                  scale={scale}
                  currentPage={pageIdx + 1}
                  totalPages={totalPagesCount}
                />
              ))}
          </div>

          {/* Details / Table section (paginated contents) */}
          <div className="my-2 relative z-10" style={{ minHeight: `${availableDetailsHeight * 0.8 * scale}px` }}>
            {/* 1. Main dynamic columns table */}
            {layout.details.columns && layout.details.columns.length > 0 && (
              <TableComponent
                columns={layout.details.columns}
                items={pageItems}
                properties={layout.details.properties}
                scale={scale}
                dir={dir}
              />
            )}

            {/* 2. Visual layout Repeater Engine */}
            {layout.details.elements && layout.details.elements.length > 0 && (
              <div className="relative" style={{ height: `${(layout.details.height || 20) * pageItems.length * scale}px` }}>
                {pageItems.map((item, rowIdx) => {
                  const itemDocData = {
                    ...data,
                    product_code: item.product_code,
                    product_name: item.product_name,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price: item.unit_price,
                    discount: item.discount,
                    vat_amount: item.vat_amount,
                    total: item.total
                  };
                  
                  const rowOffset = rowIdx * (layout.details.height || 20);
                  return (
                    <React.Fragment key={rowIdx}>
                      {layout.details.elements!.map(el => (
                        <TemplateElementDispatcher
                          key={`${el.id}-row-${rowIdx}`}
                          el={{
                            ...el,
                            y: el.y + rowOffset
                          }}
                          data={itemDocData}
                          scale={scale}
                          currentPage={pageIdx + 1}
                          totalPages={totalPagesCount}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer section (fixed height) */}
          <div style={{ height: `${layout.footerHeight * scale}px`, width: '100%' }} className="relative z-10 absolute bottom-0 left-0 right-0">
            {layout.footer
              .filter(el => shouldRenderElement(el, pageIdx, totalPagesCount))
              .map(el => (
                <TemplateElementDispatcher
                  key={el.id}
                  el={el}
                  data={data}
                  scale={scale}
                  currentPage={pageIdx + 1}
                  totalPages={totalPagesCount}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
