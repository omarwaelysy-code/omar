import React from 'react';
import QRCode from 'react-qr-code';
import BarcodeComponent from 'react-barcode';

export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'logo' | 'line' | 'rectangle' | 'circle' | 'barcode' | 'qr' | 'variable' | 'field';
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
    };
  };
  footer: TemplateElement[];
}

export interface NormalizedDocument {
  company_logo?: string;
  company_name?: string;
  branch_name?: string;
  user_name?: string;
  date?: string;
  time?: string;
  document_number?: string;
  customer_name?: string;
  supplier_name?: string;
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
    branch_name: data?.branch_name || 'الفرع الرئيسي',
    user_name: currentUser?.username || data?.created_by || 'المشرف',
    date: data?.date || data?.created_at ? new Date(data.date || data.created_at).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA'),
    time: data?.created_at ? new Date(data.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    currency_code: company?.currency || data?.currency_code || 'SAR',
    payment_method: data?.payment_method_name || data?.payment_type || 'نقداً',
    items: [],
    dynamicFields: {}
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
      total: Number(itm.total || 0)
    }));
  } 
  else if (type === 'purchase_invoices') {
    doc.document_number = data.invoice_number;
    doc.supplier_name = data.supplier_name;
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
      total: Number(itm.total || 0)
    }));
  } 
  else if (type === 'returns' || type === 'purchase_returns') {
    doc.document_number = data.return_number;
    doc.customer_name = data.customer_name || '';
    doc.supplier_name = data.supplier_name || '';
    doc.subtotal = Number(data.total_amount || 0);
    doc.discount_amount = 0;
    doc.vat_amount = 0;
    doc.net_total = Number(data.total_amount || 0);
    doc.paid_amount = Number(data.total_amount || 0);
    doc.remaining_amount = 0;

    const itemsRaw = data.return_items || data.purchase_return_items || data.items || [];
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
  width?: number;
  dir?: 'ltr' | 'rtl';
}

export function TemplateRenderer({
  layout,
  data,
  scale = 3.5,
  margin = { top: 10, bottom: 10, left: 10, right: 10 },
  width = 210,
  dir = 'rtl'
}: TemplateRendererProps) {
  const printableWidth = width - margin.left - margin.right;

  const renderElement = (el: TemplateElement) => {
    if (el.properties.hidden) return null;

    let displayValue: any = '';

    if (el.type === 'text') {
      displayValue = el.properties.text || '';
    } else if (el.type === 'variable') {
      const boundVal = data[el.binding as keyof NormalizedDocument];
      displayValue = boundVal !== undefined && typeof boundVal !== 'object' ? String(boundVal) : '';
    } else if (el.type === 'field') {
      displayValue = data.dynamicFields?.[el.binding || ''] || '';
    }

    return (
      <div
        key={el.id}
        className="absolute flex items-center select-none"
        style={{
          left: `${el.x * scale}px`,
          top: `${el.y * scale}px`,
          width: `${el.width * scale}px`,
          height: `${el.height * scale}px`,
          fontFamily: el.properties.fontFamily || 'Cairo',
          fontSize: `${(el.properties.fontSize || 10) * (scale / 3.5)}pt`,
          fontWeight: el.properties.bold ? 'bold' : 'normal',
          fontStyle: el.properties.italic ? 'italic' : 'normal',
          textDecoration: el.properties.underline ? 'underline' : 'none',
          color: el.properties.color || '#000000',
          backgroundColor: el.properties.backgroundColor || 'transparent',
          border: el.properties.borderWidth ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` : 'none',
          borderRadius: el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
          textAlign: el.properties.align || 'left',
          opacity: el.properties.opacity ?? 1,
          transform: `rotate(${el.properties.rotation || 0}deg)`,
          justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
          padding: `${(el.properties.padding || 0) * scale}px`,
          lineHeight: el.properties.lineHeight || 1.2
        }}
      >
        {el.type === 'logo' && (
          data.company_logo ? (
            <img src={data.company_logo} alt="logo" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full border border-zinc-200 bg-zinc-50 rounded flex items-center justify-center text-[10px] text-zinc-400 font-bold">
              LOGO
            </div>
          )
        )}
        {el.type === 'image' && (
          el.properties.imageUrl ? (
            <img src={el.properties.imageUrl} alt="custom" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full border border-dashed border-zinc-200 bg-zinc-50 rounded" />
          )
        )}
        {el.type === 'line' && (
          <div 
            className="w-full h-full" 
            style={{ 
              borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
              borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
            }} 
          />
        )}
        {el.type === 'rectangle' && <div className="w-full h-full" />}
        {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
        {el.type === 'qr' && (
          <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center">
            <QRCode 
              value={typeof displayValue === 'string' && displayValue ? displayValue : `INV:${data.document_number || ''}|NET:${data.net_total || 0}|VAT:${data.vat_amount || 0}`} 
              size={Math.min(el.width, el.height) * scale - 4} 
            />
          </div>
        )}
        {el.type === 'barcode' && (
          <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center w-full h-full overflow-hidden">
            <BarcodeComponent 
              value={typeof displayValue === 'string' && displayValue ? displayValue : (data.document_number || '00000000')} 
              width={1.2} 
              height={Math.min(el.height) * scale - 10} 
              displayValue={false} 
            />
          </div>
        )}
        {['text', 'variable', 'field'].includes(el.type) && displayValue}
      </div>
    );
  };

  return (
    <div
      className="bg-white border border-zinc-300 shadow-xl relative overflow-hidden text-zinc-900"
      style={{
        width: `${printableWidth * scale}px`,
        paddingTop: `${margin.top * scale}px`,
        paddingBottom: `${margin.bottom * scale}px`,
        paddingLeft: `${margin.left * scale}px`,
        paddingRight: `${margin.right * scale}px`,
        backgroundImage: layout.bgImage ? `url(${layout.bgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      dir={dir}
    >
      {/* Watermark */}
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

      {/* Header section */}
      <div style={{ height: `${layout.headerHeight * scale}px`, width: '100%' }} className="relative z-10">
        {layout.header.map(renderElement)}
      </div>

      {/* Details section */}
      <div className="my-4 relative z-10">
        <table
          className="w-full border-collapse"
          style={{
            fontSize: `${(layout.details.properties.fontSize || 10) * (scale / 3.5)}pt`,
            fontFamily: layout.details.properties.fontFamily || 'Cairo',
            borderColor: layout.details.properties.borderColor || '#e4e4e7'
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: layout.details.properties.headerBgColor || '#f4f4f5',
                borderColor: layout.details.properties.borderColor || '#e4e4e7'
              }}
              className="border-b"
            >
              {layout.details.columns.map(col => (
                <th
                  key={col.id}
                  className={`border border-zinc-200 p-2 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                  style={{
                    width: `${col.width}%`,
                    borderColor: layout.details.properties.borderColor || '#e4e4e7',
                    fontWeight: layout.details.properties.boldHeader ? 'bold' : 'normal',
                    padding: `${layout.details.properties.paddingY ?? 2}px ${layout.details.properties.paddingX ?? 2}px`
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  backgroundColor: layout.details.properties.bodyBgColor || '#ffffff',
                  borderColor: layout.details.properties.borderColor || '#e4e4e7',
                  height: `${(layout.details.properties.rowHeight || 8) * scale}px`
                }}
                className="border-b"
              >
                {layout.details.columns.map(col => (
                  <td
                    key={col.id}
                    className="border p-2 text-zinc-800"
                    style={{
                      borderColor: layout.details.properties.borderColor || '#e4e4e7',
                      padding: `${layout.details.properties.paddingY ?? 2}px ${layout.details.properties.paddingX ?? 2}px`
                    }}
                  >
                    {item[col.field as keyof typeof item] ?? `[${col.label}]`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer section */}
      <div style={{ height: `${layout.footerHeight * scale}px`, width: '100%' }} className="relative z-10">
        {layout.footer.map(renderElement)}
      </div>
    </div>
  );
}
