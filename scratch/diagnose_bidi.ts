import { generatePDF } from '../src/lib/pdf-generator';
import fs from 'fs';
import path from 'path';

async function testSingleText() {
  const customLayout = {
    paperWidth: 210,
    paperHeight: 297,
    headerHeight: 83,
    footerHeight: 58,
    margins: {
      top: 19,
      bottom: 60,
      left: 11,
      right: 7
    },
    header: [
      {
        id: 'review-title',
        type: 'text',
        x: 100, // 100mm from left margin => 11 + 100 = 111mm on paper
        y: 20,  // 20mm from top margin => 19 + 20 = 39mm on paper
        width: 60,
        height: 10,
        properties: {
          text: 'مراجع الفاتورة',
          fontSize: 16,
          bold: true,
          align: 'center',
          color: '#dc2626'
        }
      },
      {
        id: 'cust-name-val',
        type: 'variable',
        x: 130, // 130mm from left margin
        y: 40,  // 40mm from top margin
        width: 60,
        height: 10,
        properties: {
          text: 'العميل : {customer_name}',
          fontSize: 14,
          bold: true,
          align: 'right',
          color: '#0f172a'
        },
        binding: 'customer_name'
      }
    ],
    footer: []
  };

  const dto = {
    invoice_number: 'INV-2026-08-000001',
    date: '4/8/2026',
    customer_name: 'شركة الامل الجديد',
    net_total: '34761.13',
    subtotal: '30492.23',
    vat_amount: '4268.90',
    items: [],
    customLayout
  };

  const buffer = await generatePDF('SalesInvoicePdf', dto);
  const outputPath = path.join(process.cwd(), 'scratch', 'test_thankyou.pdf');
  fs.writeFileSync(outputPath, buffer);
  console.log("PDF Created Successfully at", outputPath);
}

testSingleText().catch(console.error);
