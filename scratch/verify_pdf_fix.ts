import { generatePDF } from '../src/lib/pdf-generator';
import fs from 'fs';
import path from 'path';

async function testPdf() {
  const customLayout = {
    paperWidth: 210,
    paperHeight: 297,
    headerHeight: 83,
    footerHeight: 58,
    margins: {
      top: 53,
      bottom: 60,
      left: 52,
      right: 60
    },
    header: [
      {
        id: 'title-default',
        type: 'text',
        x: 10, // 10mm from left margin => 52 + 10 = 62mm on paper
        y: 6,  // 6mm from top margin => 53 + 6 = 59mm on paper
        width: 80,
        height: 10,
        properties: {
          text: 'فاتورة مبيعات مخصصة 100%',
          fontSize: 20,
          bold: true,
          align: 'center',
          color: '#0f172a'
        }
      }
    ],
    footer: [
      {
        id: 'sig-accountant',
        type: 'text',
        x: 20, // 20mm from left margin => 52 + 20 = 72mm on paper
        y: 10,
        width: 65,
        height: 6,
        properties: {
          text: 'توقيع المحاسب المخصص 100%',
          fontSize: 10,
          bold: true,
          align: 'center',
          color: '#1e293b'
        }
      }
    ]
  };

  const dto = {
    invoice_number: 'INV-2026-TEST',
    date: '2026-08-07',
    customer_name: 'شركة الأمل الجديد',
    net_total: '34761.13',
    subtotal: '30492.23',
    vat_amount: '4268.90',
    items: [
      { product_code: 'PRD-001', product_name: 'قميص', quantity: 1, unit_price: 150, vat_rate: 0, vat_amount: 0, total: 150 }
    ],
    customLayout
  };

  const buffer = await generatePDF('SalesInvoicePdf', dto);
  const outputPath = path.join(process.cwd(), 'scratch', 'verified_invoice.pdf');
  fs.writeFileSync(outputPath, buffer);
  console.log(`PDF Generated Successfully! File size: ${buffer.length} bytes at ${outputPath}`);
}

testPdf().catch(console.error);
