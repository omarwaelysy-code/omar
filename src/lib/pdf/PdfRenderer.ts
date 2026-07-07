import { PdfTheme } from './PdfTheme';
import { drawHeader } from './PdfHeader';
import { drawTable } from './PdfTable';
import { drawTextLine, drawText } from './PdfText';

// ----------------------------------------------------
// Reusable Layout Components
// ----------------------------------------------------

function drawMetaGrid(doc: any, y: number, items: Array<{ label: string; value: string }>): number {
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;
  const boxWidth = pageWidth - 2 * margin;
  const boxHeight = 35;
  const padding = 6;

  // Draw background and border
  doc.rect(margin, y, boxWidth, boxHeight)
     .fillAndStroke(PdfTheme.colors.bgLight, PdfTheme.colors.border);

  const colWidth = boxWidth / items.length;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // RTL layout order
    const colX = margin + (items.length - 1 - i) * colWidth;

    // Draw label
    drawTextLine(doc, item.label, colX + padding, y + 6, {
      font: PdfTheme.fonts.regular,
      fontSize: 8,
      color: PdfTheme.colors.textLight,
      width: colWidth - 2 * padding,
      align: 'right'
    });

    // Draw value
    drawTextLine(doc, item.value, colX + padding, y + 18, {
      font: PdfTheme.fonts.bold,
      fontSize: 8.5,
      color: PdfTheme.colors.text,
      width: colWidth - 2 * padding,
      align: 'right'
    });
  }

  return y + boxHeight + 15;
}

function drawInvoiceTotals(doc: any, y: number, dto: any): number {
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;
  const pageHeight = PdfTheme.dimensions.pageHeight;
  const pageLimit = pageHeight - margin - 35;

  const boxWidth = 180;
  const boxHeight = Number(dto.discount_amount) > 0 ? 58 : 46;
  const boxX = pageWidth - margin - boxWidth;
  const padding = 6;

  let currentY = y;
  // If totals box overflows page limit, page break
  if (currentY + boxHeight > pageLimit) {
    doc.addPage();
    // In a multipage document, final totals usually end up on the last page.
    // Reset to margin Y if new page is spawned.
    currentY = margin + 10;
  }

  // Draw container
  doc.rect(boxX, currentY, boxWidth, boxHeight)
     .fillAndStroke(PdfTheme.colors.bgLight, PdfTheme.colors.primary);

  let textY = currentY + 5;
  const rowHeight = 11;

  // Subtotal
  drawTextLine(doc, 'الإجمالي الفرعي:', boxX + padding, textY, {
    font: PdfTheme.fonts.regular,
    fontSize: 7.5,
    color: PdfTheme.colors.textLight
  });
  drawTextLine(doc, String(dto.subtotal || '0.00'), boxX + padding, textY, {
    font: PdfTheme.fonts.bold,
    fontSize: 7.5,
    color: PdfTheme.colors.text,
    width: boxWidth - 2 * padding,
    align: 'left'
  });
  textY += rowHeight;

  // Discount
  if (Number(dto.discount_amount) > 0) {
    drawTextLine(doc, 'الخصم:', boxX + padding, textY, {
      font: PdfTheme.fonts.regular,
      fontSize: 7.5,
      color: PdfTheme.colors.textLight
    });
    drawTextLine(doc, String(dto.discount_amount), boxX + padding, textY, {
      font: PdfTheme.fonts.bold,
      fontSize: 7.5,
      color: PdfTheme.colors.text,
      width: boxWidth - 2 * padding,
      align: 'left'
    });
    textY += rowHeight;
  }

  // Tax
  drawTextLine(doc, 'الضريبة (15%):', boxX + padding, textY, {
    font: PdfTheme.fonts.regular,
    fontSize: 7.5,
    color: PdfTheme.colors.textLight
  });
  drawTextLine(doc, String(dto.vat_amount || '0.00'), boxX + padding, textY, {
    font: PdfTheme.fonts.bold,
    fontSize: 7.5,
    color: PdfTheme.colors.text,
    width: boxWidth - 2 * padding,
    align: 'left'
  });
  textY += rowHeight;

  // Separator
  doc.strokeColor(PdfTheme.colors.border)
     .lineWidth(0.5)
     .moveTo(boxX + padding, textY + 2)
     .lineTo(boxX + boxWidth - padding, textY + 2)
     .stroke();
  textY += 4;

  // Net Total
  drawTextLine(doc, 'الصافي النهائي:', boxX + padding, textY, {
    font: PdfTheme.fonts.bold,
    fontSize: 8,
    color: PdfTheme.colors.primaryDark
  });
  drawTextLine(doc, String(dto.net_total || '0.00'), boxX + padding, textY, {
    font: PdfTheme.fonts.bold,
    fontSize: 8,
    color: PdfTheme.colors.primaryDark,
    width: boxWidth - 2 * padding,
    align: 'left'
  });

  return currentY + boxHeight + 15;
}

function drawSignaturesSection(doc: any, y: number, leftTitle: string, rightTitle: string, onNewPageHeader: any) {
  const pageHeight = PdfTheme.dimensions.pageHeight;
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;
  const pageLimit = pageHeight - margin - 75;

  let currentY = y;
  if (currentY > pageLimit) {
    doc.addPage();
    currentY = onNewPageHeader(doc) + 10;
  }

  const lineY = currentY + 30;

  // Left Line & Title
  doc.strokeColor(PdfTheme.colors.textMuted)
     .lineWidth(0.5)
     .moveTo(margin + 20, lineY)
     .lineTo(margin + 170, lineY)
     .stroke();

  drawTextLine(doc, leftTitle, margin + 20, lineY + 5, {
    font: PdfTheme.fonts.bold,
    fontSize: 8,
    color: PdfTheme.colors.textLight,
    width: 150,
    align: 'center'
  });

  // Right Line & Title
  doc.strokeColor(PdfTheme.colors.textMuted)
     .lineWidth(0.5)
     .moveTo(pageWidth - margin - 170, lineY)
     .lineTo(pageWidth - margin - 20, lineY)
     .stroke();

  drawTextLine(doc, rightTitle, pageWidth - margin - 170, lineY + 5, {
    font: PdfTheme.fonts.bold,
    fontSize: 8,
    color: PdfTheme.colors.textLight,
    width: 150,
    align: 'center'
  });

  return lineY + 25;
}

// ----------------------------------------------------
// Specific Templates Renderer
// ----------------------------------------------------

export function renderTemplate(doc: any, templateName: string, dto: any) {
  const company = dto.company || {};
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;

  // Define new page header generator callback
  const headerTitle = resolveTitle(templateName, dto);
  const onNewPageHeader = (d: any) => {
    return drawHeader(d, company, headerTitle, dto.branchName, dto.userName, dto.date);
  };

  // 1. Initial Page Header
  let currentY = onNewPageHeader(doc);

  switch (templateName) {
    case 'InvoiceTemplate':
    case 'SalesInvoicePdf':
    case 'PurchaseInvoicePdf': {
      const isSales = templateName.includes('Sales') || templateName === 'InvoiceTemplate';
      const partyLabel = isSales ? 'العميل' : 'المورد';
      const partyName = isSales ? dto.customer_name : dto.supplier_name;
      const partyTaxNum = isSales ? dto.customer_tax_number : dto.supplier_tax_number;

      // Meta grid
      currentY = drawMetaGrid(doc, currentY, [
        { label: 'رقم الفاتورة:', value: dto.invoice_number || '' },
        { label: 'طريقة الدفع:', value: dto.payment_method || '' },
        { label: partyLabel, value: partyName || '' },
        ...(partyTaxNum ? [{ label: 'الرقم الضريبي:', value: partyTaxNum }] : [])
      ]);

      // Items table
      const columns = [
        { id: 'product_code', label: 'كود الصنف', width: 20, align: 'right' as const },
        { id: 'product_name', label: 'الصنف', width: 35, align: 'right' as const },
        { id: 'quantity', label: 'الكمية', width: 12, align: 'center' as const },
        { id: 'unit', label: 'الوحدة', width: 10, align: 'center' as const },
        { id: 'unit_price', label: 'السعر', width: 12, align: 'left' as const },
        { id: 'discount', label: 'الخصم', width: 10, align: 'left' as const },
        { id: 'vat_amount', label: 'الضريبة', width: 12, align: 'left' as const },
        { id: 'total', label: 'الإجمالي', width: 15, align: 'left' as const }
      ];

      currentY = drawTable(doc, columns, dto.items || [], currentY, onNewPageHeader);
      currentY += 10;

      // Totals Box
      currentY = drawInvoiceTotals(doc, currentY, dto);

      // Signatures
      const leftSig = isSales ? 'توقيع المحاسب' : 'توقيع المشتريات';
      const rightSig = isSales ? 'توقيع العميل' : 'اعتماد الإدارة';
      drawSignaturesSection(doc, currentY, leftSig, rightSig, onNewPageHeader);
      break;
    }

    case 'StatementTemplate':
    case 'CustomerStatementPdf':
    case 'SupplierStatementPdf': {
      const isCust = templateName.includes('Customer') || templateName === 'StatementTemplate';
      const partyName = isCust ? dto.customer_name : dto.supplier_name;

      // Meta Grid
      currentY = drawMetaGrid(doc, currentY, [
        { label: 'الاسم:', value: partyName || '' },
        { label: 'الفترة:', value: `من ${dto.date_from || ''} إلى ${dto.date_to || ''}` },
        { label: 'الرصيد الافتتاحي:', value: String(dto.starting_balance || '0.00') },
        { label: 'الرصيد الختامي:', value: String(dto.ending_balance || '0.00') }
      ]);

      // Table
      const columns = [
        { id: 'date', label: 'التاريخ', width: 15, align: 'center' as const },
        { id: 'reference', label: 'المرجع', width: 15, align: 'center' as const },
        { id: 'description', label: 'البيان', width: 40, align: 'right' as const },
        { id: 'debit', label: 'مدين', width: 15, align: 'left' as const },
        { id: 'credit', label: 'دائن', width: 15, align: 'left' as const },
        { id: 'balance', label: 'الرصيد', width: 15, align: 'left' as const }
      ];

      // Add final total row
      const tableRows = [...(dto.rows || [])];
      tableRows.push({
        date: '',
        reference: '',
        description: 'الإجمالي الختامي',
        debit: dto.total_debit || '0.00',
        credit: dto.total_credit || '0.00',
        balance: dto.ending_balance || '0.00',
        isTotalRow: true
      });

      drawTable(doc, columns, tableRows, currentY, onNewPageHeader);
      break;
    }

    case 'LedgerTemplate':
    case 'LedgerPdf': {
      currentY = drawMetaGrid(doc, currentY, [
        { label: 'التقرير:', value: 'دفتر الأستاذ العام' },
        { label: 'الفترة:', value: `من ${dto.date_from || ''} إلى ${dto.date_to || ''}` }
      ]);

      const columns = [
        { id: 'date', label: 'التاريخ', width: 12, align: 'center' as const },
        { id: 'entry_num', label: 'رقم القيد', width: 13, align: 'center' as const },
        { id: 'account_code', label: 'كود الحساب', width: 15, align: 'center' as const },
        { id: 'account_name', label: 'اسم الحساب', width: 20, align: 'right' as const },
        { id: 'description', label: 'البيان', width: 25, align: 'right' as const },
        { id: 'debit', label: 'مدين', width: 12, align: 'left' as const },
        { id: 'credit', label: 'دائن', width: 12, align: 'left' as const }
      ];

      const tableRows = [...(dto.rows || [])];
      tableRows.push({
        date: '',
        entry_num: '',
        account_code: '',
        account_name: '',
        description: 'الإجمالي',
        debit: dto.total_debit || '0.00',
        credit: dto.total_credit || '0.00',
        isTotalRow: true
      });

      drawTable(doc, columns, tableRows, currentY, onNewPageHeader);
      break;
    }

    case 'VoucherTemplate':
    case 'VoucherPdf': {
      const isReceipt = dto.isReceipt === true;

      currentY = drawMetaGrid(doc, currentY, [
        { label: 'رقم السند:', value: dto.voucher_number || '' },
        { label: 'طريقة الدفع:', value: dto.payment_method || '' },
        { label: isReceipt ? 'مستلم من:' : 'مدفوع لـ:', value: dto.party_name || '' },
        { label: 'المبلغ الإجمالي:', value: String(dto.amount || '0.00') }
      ]);

      // Description Box
      if (dto.description) {
        doc.rect(margin, currentY, pageWidth - 2 * margin, 30)
           .fillAndStroke(PdfTheme.colors.bgLight, PdfTheme.colors.border);
        
        drawTextLine(doc, 'البيان / الشرح:', margin + 6, currentY + 4, {
          font: PdfTheme.fonts.regular,
          fontSize: 7.5,
          color: PdfTheme.colors.textLight
        });

        drawTextLine(doc, dto.description, margin + 6, currentY + 14, {
          font: PdfTheme.fonts.bold,
          fontSize: 8.5,
          color: PdfTheme.colors.text,
          width: pageWidth - 2 * margin - 12,
          align: 'right'
        });
        currentY += 45;
      }

      // Render lines table if available
      if (dto.items && dto.items.length > 0) {
        const columns = [
          { id: 'account_code', label: 'كود الحساب', width: 20, align: 'center' as const },
          { id: 'account_name', label: 'اسم الحساب الموجه', width: 35, align: 'right' as const },
          { id: 'description', label: 'شرح السطر', width: 30, align: 'right' as const },
          { id: 'amount', label: 'المبلغ', width: 15, align: 'left' as const }
        ];

        const tableRows = [...dto.items];
        tableRows.push({
          account_code: '',
          account_name: '',
          description: 'الإجمالي',
          amount: dto.amount || '0.00',
          isTotalRow: true
        });

        currentY = drawTable(doc, columns, tableRows, currentY, onNewPageHeader);
        currentY += 10;
      }

      drawSignaturesSection(doc, currentY, 'توقيع أمين الصندوق', 'توقيع المستلم', onNewPageHeader);
      break;
    }

    // Generic / Fallback Report Template
    default: {
      const columns = (dto.columns || []).map((col: any) => ({
        id: col.id,
        label: col.label || '',
        width: col.width || 10,
        align: col.align || 'right'
      }));

      const rows = [...(dto.rows || [])];
      
      // Append total row if totals dictionary is not empty
      if (dto.totals && Object.keys(dto.totals).length > 0) {
        rows.push({
          ...dto.totals,
          isTotalRow: true
        });
      }

      drawTable(doc, columns, rows, currentY, onNewPageHeader);
      break;
    }
  }
}

function resolveTitle(templateName: string, dto: any): string {
  switch (templateName) {
    case 'InvoiceTemplate':
    case 'SalesInvoicePdf':
      return 'فاتورة مبيعات';
    case 'PurchaseInvoicePdf':
      return 'فاتورة مشتريات';
    case 'StatementTemplate':
    case 'CustomerStatementPdf':
      return 'كشف حساب عميل';
    case 'SupplierStatementPdf':
      return 'كشف حساب مورد';
    case 'LedgerTemplate':
    case 'LedgerPdf':
      return 'دفتر الأستاذ العام';
    case 'VoucherTemplate':
    case 'VoucherPdf':
      return dto.isReceipt ? 'سند قبض نقدي / بنكي' : 'سند صرف نقدي / بنكي';
    default:
      return dto.reportTitle || 'تقرير النظام';
  }
}
