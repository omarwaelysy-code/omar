import React from 'react';
import QRCode from 'react-qr-code';
import BarcodeComponent from 'react-barcode';
import { NormalizedDocument, TemplateElement, DetailsColumn } from './TemplateRenderer';
import { evaluateCondition } from '../utils/templateValidation';

interface ElementComponentProps {
  el: TemplateElement;
  data: NormalizedDocument;
  scale: number;
  currentPage?: number;
  totalPages?: number;
}

export function evaluateConditionLocal(cond: TemplateElement['properties']['condition'], data: NormalizedDocument): boolean {
  if (!cond || !cond.enabled) return true;
  
  let actualVal: any = data[cond.field as keyof NormalizedDocument];
  if (actualVal === undefined) {
    actualVal = data.dynamicFields?.[cond.field] ?? '';
  }
  
  const stringVal = String(actualVal ?? '').trim();
  const compareVal = String(cond.value ?? '').trim();

  switch (cond.operator) {
    case 'is_empty':
      return stringVal === '';
    case 'is_not_empty':
      return stringVal !== '';
    case 'equals':
      return stringVal === compareVal;
    case 'not_equals':
      return stringVal !== compareVal;
    case 'greater_than':
      return Number(stringVal) > Number(compareVal);
    case 'less_than':
      return Number(stringVal) < Number(compareVal);
    case 'contains':
      return stringVal.toLowerCase().includes(compareVal.toLowerCase());
    default:
      return true;
  }
}

export function getSharedStyles(el: TemplateElement, scale: number): React.CSSProperties {
  return {
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
  };
}

// 1. Text Component
export const TextElement: React.FC<ElementComponentProps> = ({ el, scale }) => {
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {el.properties.text || ''}
    </div>
  );
};

// 2. Variable Component
export const VariableElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  const boundVal = data[el.binding as keyof NormalizedDocument];
  const displayValue = boundVal !== undefined && typeof boundVal !== 'object' ? String(boundVal) : '';
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {displayValue}
    </div>
  );
};

// 3. Dynamic Field Component
export const DynamicFieldElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  const displayValue = data.dynamicFields?.[el.binding || ''] || '';
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {displayValue}
    </div>
  );
};

// 4. Image Component
export const ImageElement: React.FC<ElementComponentProps> = ({ el, scale }) => {
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {el.properties.imageUrl ? (
        <img src={el.properties.imageUrl} alt="custom" className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full border border-dashed border-zinc-200 bg-zinc-50 rounded" />
      )}
    </div>
  );
};

// 5. Logo Component
export const LogoElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  return (
    <div className="absolute flex items-center select-none font-bold" style={getSharedStyles(el, scale)}>
      {data.company_logo ? (
        <img src={data.company_logo} alt="logo" className="w-full h-full object-contain pointer-events-none" />
      ) : (
        <div className="w-full h-full border border-dashed border-zinc-300 bg-zinc-50/50 rounded flex items-center justify-center text-[10px] text-zinc-400 font-extrabold uppercase">
          [ LOGO ]
        </div>
      )}
    </div>
  );
};

// 6. Shape Component
export const ShapeElement: React.FC<ElementComponentProps> = ({ el, scale }) => {
  const styles = getSharedStyles(el, scale);
  if (el.type === 'line') {
    return (
      <div 
        className="absolute select-none" 
        style={{
          ...styles,
          borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
          borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
        }} 
      />
    );
  }
  if (el.type === 'circle') {
    return (
      <div 
        className="absolute select-none rounded-full" 
        style={{
          ...styles,
          border: `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}`,
          backgroundColor: el.properties.backgroundColor || 'transparent'
        }} 
      />
    );
  }
  // Rectangle
  return (
    <div 
      className="absolute select-none" 
      style={{
        ...styles,
        border: `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}`,
        backgroundColor: el.properties.backgroundColor || 'transparent',
        borderRadius: el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px'
      }} 
    />
  );
};

// 7. QR Component
export const QrElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  let val = '';
  if (el.binding) {
    const boundVal = data[el.binding as keyof NormalizedDocument];
    if (boundVal !== undefined && typeof boundVal !== 'object') {
      val = String(boundVal);
    } else if (data.dynamicFields?.[el.binding] !== undefined) {
      val = String(data.dynamicFields[el.binding]);
    }
  }

  if (!val) {
    return (
      <div className="absolute flex flex-col items-center justify-center bg-zinc-50 border border-dashed border-zinc-300 text-zinc-400 p-1 text-center rounded overflow-hidden" style={getSharedStyles(el, scale)}>
        <span style={{ fontSize: `${Math.max(6, 8 * scale)}px` }} className="font-black tracking-tight leading-none">QR Code</span>
        <span style={{ fontSize: `${Math.max(5, 7 * scale)}px` }} className="opacity-65 mt-0.5 leading-none">{el.binding || 'No Source'}</span>
      </div>
    );
  }

  return (
    <div className="absolute flex items-center justify-center p-0.5 bg-white border border-zinc-100" style={getSharedStyles(el, scale)}>
      <QRCode 
        value={val} 
        size={Math.min(el.width, el.height) * scale - 4} 
      />
    </div>
  );
};

// 8. Barcode Component
export const BarcodeElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  let val = '';
  if (el.binding) {
    const boundVal = data[el.binding as keyof NormalizedDocument];
    if (boundVal !== undefined && typeof boundVal !== 'object') {
      val = String(boundVal);
    } else if (data.dynamicFields?.[el.binding] !== undefined) {
      val = String(data.dynamicFields[el.binding]);
    }
  }

  if (!val) {
    return (
      <div className="absolute flex flex-col items-center justify-center bg-zinc-50 border border-dashed border-zinc-300 text-zinc-400 p-1 text-center rounded overflow-hidden" style={getSharedStyles(el, scale)}>
        <span style={{ fontSize: `${Math.max(6, 8 * scale)}px` }} className="font-black tracking-tight leading-none">Barcode</span>
        <span style={{ fontSize: `${Math.max(5, 7 * scale)}px` }} className="opacity-65 mt-0.5 leading-none">{el.binding || 'No Source'}</span>
      </div>
    );
  }

  const isValidBarcode = /^[\x00-\x7F]*$/.test(val);
  if (!isValidBarcode) {
    return (
      <div className="absolute flex flex-col items-center justify-center bg-red-50 border border-red-250 text-red-500 p-1 text-center rounded overflow-hidden" style={getSharedStyles(el, scale)}>
        <span style={{ fontSize: `${Math.max(5, 7 * scale)}px` }} className="font-extrabold leading-none">Invalid Barcode</span>
        <span style={{ fontSize: `${Math.max(4, 6 * scale)}px` }} className="break-all mt-0.5 leading-tight">{val}</span>
      </div>
    );
  }

  return (
    <div className="absolute flex items-center justify-center p-0.5 bg-white border border-zinc-100 overflow-hidden w-full h-full" style={getSharedStyles(el, scale)}>
      <BarcodeComponent 
        value={val} 
        width={1.1} 
        height={Math.min(el.height) * scale - 12} 
        displayValue={false} 
      />
    </div>
  );
};

// 9. Signature Component
export const SignatureElement: React.FC<ElementComponentProps> = ({ el, scale }) => {
  return (
    <div className="absolute flex flex-col justify-end items-center select-none" style={getSharedStyles(el, scale)}>
      <div className="text-[10px] text-zinc-400 mb-1">{el.properties.text || 'التوقيع / Signature'}</div>
      <div className="border-b border-dashed border-zinc-300 w-4/5 h-0"></div>
    </div>
  );
};

// 10. Page Number Component
export const PageNumberElement: React.FC<ElementComponentProps> = ({ el, scale, currentPage = 1, totalPages = 1 }) => {
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {`صفحة ${currentPage} من ${totalPages}`}
    </div>
  );
};

// --- Table Engine Component ---
interface TableComponentProps {
  columns: DetailsColumn[];
  items: any[];
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
  scale: number;
  dir: 'ltr' | 'rtl';
}

export const TableComponent: React.FC<TableComponentProps> = ({
  columns,
  items,
  properties,
  scale,
  dir
}) => {
  // Compute column totals for number fields
  const computeTotal = (field: string) => {
    const isNumberField = ['quantity', 'unit_price', 'discount', 'vat_amount', 'total'].includes(field);
    if (!isNumberField) return '';
    const total = items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
    return total > 0 ? total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
  };

  return (
    <table
      className="w-full border-collapse"
      style={{
        fontSize: `${(properties.fontSize || 10) * (scale / 3.5)}pt`,
        fontFamily: properties.fontFamily || 'Cairo',
        borderColor: properties.borderColor || '#e4e4e7'
      }}
    >
      <thead>
        <tr
          style={{
            backgroundColor: properties.headerBgColor || '#f4f4f5',
            borderColor: properties.borderColor || '#e4e4e7'
          }}
          className="border-b"
        >
          {properties.showRowNumbers && (
            <th
              className="border border-zinc-200 p-2 font-bold text-center"
              style={{
                width: '5%',
                borderColor: properties.borderColor || '#e4e4e7',
                padding: `${properties.paddingY ?? 2}px ${properties.paddingX ?? 2}px`
              }}
            >
              #
            </th>
          )}
          {columns.map(col => (
            <th
              key={col.id}
              className={`border border-zinc-200 p-2 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
              style={{
                width: `${col.width}%`,
                borderColor: properties.borderColor || '#e4e4e7',
                fontWeight: properties.boldHeader ? 'bold' : 'normal',
                padding: `${properties.paddingY ?? 2}px ${properties.paddingX ?? 2}px`
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, rowIdx) => (
          <tr
            key={rowIdx}
            style={{
              backgroundColor: properties.bodyBgColor || '#ffffff',
              borderColor: properties.borderColor || '#e4e4e7',
              height: `${(properties.rowHeight || 8) * scale}px`
            }}
            className="border-b"
          >
            {properties.showRowNumbers && (
              <td
                className="border p-2 text-center text-zinc-500 font-semibold"
                style={{
                  borderColor: properties.borderColor || '#e4e4e7',
                  padding: `${properties.paddingY ?? 2}px ${properties.paddingX ?? 2}px`
                }}
              >
                {rowIdx + 1}
              </td>
            )}
            {columns.map(col => (
              <td
                key={col.id}
                className="border p-2 text-zinc-800"
                style={{
                  borderColor: properties.borderColor || '#e4e4e7',
                  padding: `${properties.paddingY ?? 2}px ${properties.paddingX ?? 2}px`
                }}
              >
                {item[col.field as keyof typeof item] ?? `[${col.label}]`}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {properties.showTotals && (
        <tfoot>
          <tr
            style={{
              backgroundColor: properties.headerBgColor || '#f4f4f5',
              borderColor: properties.borderColor || '#e4e4e7',
              fontWeight: 'bold'
            }}
            className="border-t-2 border-b"
          >
            {properties.showRowNumbers && (
              <td
                className="border p-2 text-center"
                style={{
                  borderColor: properties.borderColor || '#e4e4e7',
                  padding: `${properties.paddingY ?? 2}px ${properties.paddingX ?? 2}px`
                }}
              >
                -
              </td>
            )}
            {columns.map((col, idx) => (
              <td
                key={col.id}
                className="border p-2 text-zinc-900"
                style={{
                  borderColor: properties.borderColor || '#e4e4e7',
                  padding: `${properties.paddingY ?? 2}px ${properties.paddingX ?? 2}px`
                }}
              >
                {idx === 0 ? (dir === 'rtl' ? 'المجموع' : 'Total') : computeTotal(col.field)}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
};

// 11. Date Component
export const DateElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  const displayVal = el.binding ? (data[el.binding as keyof NormalizedDocument] || data.date || '') : (data.date || '');
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {String(displayVal)}
    </div>
  );
};

// 12. Time Component
export const TimeElement: React.FC<ElementComponentProps> = ({ el, data, scale }) => {
  const displayVal = el.binding ? (data[el.binding as keyof NormalizedDocument] || data.time || '') : (data.time || '');
  return (
    <div className="absolute flex items-center select-none" style={getSharedStyles(el, scale)}>
      {String(displayVal)}
    </div>
  );
};

// Dispatcher Component to render correct element dynamically
export const TemplateElementDispatcher: React.FC<ElementComponentProps> = (props) => {
  const { el, data } = props;
  if (el.properties.hidden) return null;
  if (!evaluateConditionLocal(el.properties.condition, data)) return null;

  switch (el.type) {
    case 'text':
      return <TextElement {...props} />;
    case 'variable':
      return <VariableElement {...props} />;
    case 'field':
      return <DynamicFieldElement {...props} />;
    case 'image':
      return <ImageElement {...props} />;
    case 'logo':
      return <LogoElement {...props} />;
    case 'line':
    case 'rectangle':
    case 'circle':
      return <ShapeElement {...props} />;
    case 'qr':
      return <QrElement {...props} />;
    case 'barcode':
      return <BarcodeElement {...props} />;
    case 'signature':
      return <SignatureElement {...props} />;
    case 'page_number':
      return <PageNumberElement {...props} />;
    case 'date':
      return <DateElement {...props} />;
    case 'time':
      return <TimeElement {...props} />;
    default:
      return null;
  }
};
