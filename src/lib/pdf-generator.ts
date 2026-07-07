import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

// ----------------------------------------------------
// Font Loading and Base64 Embedding
// ----------------------------------------------------

let regularFontBase64 = '';
let boldFontBase64 = '';

try {
  const regularPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  const boldPath = path.resolve('./public/fonts/NotoSansArabic-Bold.ttf');
  
  if (fs.existsSync(regularPath)) {
    regularFontBase64 = fs.readFileSync(regularPath).toString('base64');
  }
  if (fs.existsSync(boldPath)) {
    boldFontBase64 = fs.readFileSync(boldPath).toString('base64');
  }
} catch (e) {
  console.error('Failed to load local fonts for PDF generator:', e);
}

// ----------------------------------------------------
// CSS Styles Sheet
// ----------------------------------------------------

const getGlobalStyles = () => `
  @font-face {
    font-family: 'Noto Sans Arabic';
    src: url(data:font/truetype;charset=utf-8;base64,${regularFontBase64}) format('truetype');
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'Noto Sans Arabic';
    src: url(data:font/truetype;charset=utf-8;base64,${boldFontBase64}) format('truetype');
    font-weight: bold;
    font-style: normal;
  }

  body {
    font-family: 'Noto Sans Arabic', sans-serif;
    direction: rtl;
    text-align: right;
    color: #1f2937;
    margin: 0;
    padding: 10px;
    font-size: 11px;
    background-color: #ffffff;
    line-height: 1.4;
  }

  /* Header styles */
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #10b981;
    padding-bottom: 12px;
    margin-bottom: 15px;
  }
  .company-info {
    width: 45%;
  }
  .company-name {
    font-size: 14px;
    font-weight: bold;
    color: #064e3b;
    margin-bottom: 3px;
  }
  .company-detail {
    font-size: 9px;
    color: #4b5563;
    margin-bottom: 2px;
  }
  .logo-box {
    width: 60px;
    height: 60px;
    margin-bottom: 5px;
  }
  .logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .report-title-box {
    text-align: center;
    width: 30%;
  }
  .report-title {
    font-size: 18px;
    font-weight: bold;
    color: #064e3b;
    margin-bottom: 4px;
  }
  .meta-info {
    width: 25%;
    text-align: left;
    font-size: 9px;
    color: #4b5563;
  }
  .meta-item {
    margin-bottom: 3px;
  }

  /* Grid styles */
  .meta-grid {
    display: flex;
    justify-content: space-between;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 15px;
    margin-bottom: 15px;
  }
  .meta-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .meta-label {
    font-size: 9px;
    color: #4b5563;
  }
  .meta-val {
    font-size: 10px;
    font-weight: bold;
    color: #1f2937;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    margin-bottom: 15px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }
  th {
    background-color: #10b981;
    color: #ffffff;
    font-weight: bold;
    font-size: 9px;
    padding: 6px 8px;
    text-align: right;
    border: 1px solid #e5e7eb;
  }
  td {
    font-size: 9px;
    padding: 5px 8px;
    border: 1px solid #e5e7eb;
  }
  tr:nth-child(even) {
    background-color: #f9fafb;
  }
  .total-row {
    background-color: #f3f4f6 !important;
    font-weight: bold;
    color: #064e3b;
    border-top: 2px solid #10b981;
  }

  /* Totals box */
  .summary-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 15px;
  }
  .summary-box {
    border: 1.5px solid #10b981;
    background-color: #f9fafb;
    padding: 8px 12px;
    border-radius: 6px;
    width: 220px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 10px;
  }
  .summary-label {
    color: #4b5563;
  }
  .summary-val {
    font-weight: bold;
    color: #064e3b;
  }

  /* Signatures */
  .signature-container {
    display: flex;
    justify-content: space-around;
    margin-top: 50px;
  }
  .signature-box {
    text-align: center;
    width: 150px;
  }
  .signature-line {
    border-bottom: 1px solid #9ca3af;
    height: 35px;
    margin-bottom: 6px;
  }
  .signature-title {
    font-size: 9px;
    color: #4b5563;
    font-weight: bold;
  }

  /* Print utilities */
  @media print {
    tr {
      page-break-inside: avoid;
    }
  }
`;

// ----------------------------------------------------
// HTML Template Renderers
// ----------------------------------------------------

function renderHeader(company: any, title: string, branchName = '', userName = '', dateStr = '') {
  const currentLogo = company.logoUrl || '';
  const dateValue = dateStr || new Date().toLocaleDateString('ar-SA');
  return `
    <div class="header-container">
      <div class="company-info">
        ${currentLogo ? `<div class="logo-box"><img src="${currentLogo}" class="logo-img" /></div>` : ''}
        <div class="company-name">${company.name || ''}</div>
        ${company.taxNumber ? `<div class="company-detail">الرقم الضريبي: ${company.taxNumber}</div>` : ''}
        ${company.phone ? `<div class="company-detail">الهاتف: ${company.phone}</div>` : ''}
      </div>
      <div class="report-title-box">
        <div class="report-title">${title}</div>
        ${branchName ? `<div class="company-detail">الفرع: ${branchName}</div>` : ''}
      </div>
      <div class="meta-info">
        <div class="meta-item">المستخدم: ${userName || 'المشرف'}</div>
        <div class="meta-item">التاريخ: ${dateValue}</div>
      </div>
    </div>
  `;
}

function renderFooter() {
  return `
    <div style="position: fixed; bottom: 10px; left: 0; right: 0; display: flex; justify-content: space-between; font-size: 8px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 5px;">
      <div>نظام ERP السحابي</div>
      <div>صفحة 1 من 1</div>
    </div>
  `;
}

function generateHTML(templateName: string, dto: any): string {
  const company = dto.company || {};
  let bodyHTML = '';

  switch (templateName) {
    case 'InvoiceTemplate':
    case 'SalesInvoicePdf':
    case 'PurchaseInvoicePdf': {
      const isSales = templateName.includes('Sales') || templateName === 'InvoiceTemplate';
      const title = isSales ? 'فاتورة مبيعات' : 'فاتورة مشتريات';
      const partyLabel = isSales ? 'العميل' : 'المورد';
      const partyName = isSales ? dto.customer_name : dto.supplier_name;
      const partyTaxNum = isSales ? dto.customer_tax_number : dto.supplier_tax_number;

      bodyHTML = `
        ${renderHeader(company, title, dto.branchName, dto.userName, dto.date)}
        
        <div class="meta-grid">
          <div class="meta-col">
            <span class="meta-label">رقم الفاتورة:</span>
            <span class="meta-val">${dto.invoice_number || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">طريقة الدفع:</span>
            <span class="meta-val">${dto.payment_method || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">${partyLabel}:</span>
            <span class="meta-val">${partyName || ''}</span>
            ${partyTaxNum ? `<span class="meta-label">الرقم الضريبي: ${partyTaxNum}</span>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>كود الصنف</th>
              <th style="width: 35%;">الصنف</th>
              <th>الكمية</th>
              <th>الوحدة</th>
              <th>السعر</th>
              <th>الخصم</th>
              <th>الضريبة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${(dto.items || []).map((itm: any) => `
              <tr>
                <td>${itm.product_code || ''}</td>
                <td>${itm.product_name || ''}</td>
                <td>${itm.quantity || '0'}</td>
                <td>${itm.unit || 'حبة'}</td>
                <td>${itm.unit_price || '0.00'}</td>
                <td>${itm.discount || '0.00'}</td>
                <td>${itm.vat_amount || '0.00'}</td>
                <td>${itm.total || '0.00'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="summary-box">
            <div class="summary-row">
              <span class="summary-label">الإجمالي الفرعي:</span>
              <span class="summary-val">${dto.subtotal || '0.00'}</span>
            </div>
            ${Number(dto.discount_amount) > 0 ? `
              <div class="summary-row">
                <span class="summary-label">الخصم:</span>
                <span class="summary-val">${dto.discount_amount}</span>
              </div>
            ` : ''}
            <div class="summary-row">
              <span class="summary-label">الضريبة (15%):</span>
              <span class="summary-val">${dto.vat_amount || '0.00'}</span>
            </div>
            <div class="summary-row" style="font-weight: bold; border-top: 1px dashed #e5e7eb; padding-top: 4px; margin-top: 4px;">
              <span class="summary-label">الصافي النهائي:</span>
              <span class="summary-val">${dto.net_total || '0.00'}</span>
            </div>
          </div>
        </div>

        <div class="signature-container">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title">${isSales ? 'توقيع المحاسب' : 'توقيع المشتريات'}</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title">${isSales ? 'توقيع العميل' : 'اعتماد الإدارة'}</div>
          </div>
        </div>
      `;
      break;
    }

    case 'StatementTemplate':
    case 'CustomerStatementPdf':
    case 'SupplierStatementPdf': {
      const isCust = templateName.includes('Customer') || templateName === 'StatementTemplate';
      const title = isCust ? 'كشف حساب عميل' : 'كشف حساب مورد';
      const partyName = isCust ? dto.customer_name : dto.supplier_name;

      bodyHTML = `
        ${renderHeader(company, title, dto.branchName, dto.userName)}

        <div class="meta-grid">
          <div class="meta-col">
            <span class="meta-label">الاسم:</span>
            <span class="meta-val">${partyName || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">الفترة:</span>
            <span class="meta-val">من ${dto.date_from || ''} إلى ${dto.date_to || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">الرصيد الافتتاحي:</span>
            <span class="meta-val">${dto.starting_balance || '0.00'}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">الرصيد الختامي:</span>
            <span class="meta-val">${dto.ending_balance || '0.00'}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>المرجع</th>
              <th style="width: 40%;">البيان</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${(dto.rows || []).map((row: any) => `
              <tr>
                <td>${row.date || ''}</td>
                <td>${row.reference || ''}</td>
                <td>${row.description || ''}</td>
                <td>${row.debit || '0.00'}</td>
                <td>${row.credit || '0.00'}</td>
                <td>${row.balance || '0.00'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">الإجمالي</td>
              <td>${dto.total_debit || '0.00'}</td>
              <td>${dto.total_credit || '0.00'}</td>
              <td>${dto.ending_balance || '0.00'}</td>
            </tr>
          </tbody>
        </table>
      `;
      break;
    }

    case 'LedgerTemplate':
    case 'LedgerPdf': {
      bodyHTML = `
        ${renderHeader(company, 'دفتر الأستاذ العام', dto.branchName, dto.userName)}

        <div class="meta-grid">
          <div class="meta-col">
            <span class="meta-label">الفترة:</span>
            <span class="meta-val">من ${dto.date_from || ''} إلى ${dto.date_to || ''}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>رقم القيد</th>
              <th>كود الحساب</th>
              <th>اسم الحساب</th>
              <th style="width: 35%;">البيان</th>
              <th>مدين</th>
              <th>دائن</th>
            </tr>
          </thead>
          <tbody>
            ${(dto.rows || []).map((row: any) => `
              <tr>
                <td>${row.date || ''}</td>
                <td>${row.entry_num || ''}</td>
                <td>${row.account_code || ''}</td>
                <td>${row.account_name || ''}</td>
                <td>${row.description || ''}</td>
                <td>${row.debit || '0.00'}</td>
                <td>${row.credit || '0.00'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5">الإجمالي</td>
              <td>${dto.total_debit || '0.00'}</td>
              <td>${dto.total_credit || '0.00'}</td>
            </tr>
          </tbody>
        </table>
      `;
      break;
    }

    case 'VoucherTemplate':
    case 'VoucherPdf': {
      const title = dto.isReceipt ? 'سند قبض نقدي / بنكي' : 'سند صرف نقدي / بنكي';
      bodyHTML = `
        ${renderHeader(company, title, dto.branchName, dto.userName, dto.date)}

        <div class="meta-grid">
          <div class="meta-col">
            <span class="meta-label">رقم السند:</span>
            <span class="meta-val">${dto.voucher_number || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">طريقة الدفع:</span>
            <span class="meta-val">${dto.payment_method || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">${dto.isReceipt ? 'مستلم من' : 'مدفوع لـ'}:</span>
            <span class="meta-val">${dto.party_name || ''}</span>
          </div>
          <div class="meta-col">
            <span class="meta-label">المبلغ الإجمالي:</span>
            <span class="meta-val">${dto.amount || '0.00'}</span>
          </div>
        </div>

        ${dto.description ? `
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
            <div style="font-size: 8px; color: #4b5563; margin-bottom: 3px;">البيان / الشرح:</div>
            <div style="font-size: 10px; color: #1f2937; font-weight: bold;">${dto.description}</div>
          </div>
        ` : ''}

        ${dto.items && dto.items.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>كود الحساب</th>
                <th style="width: 40%;">اسم الحساب الموجه</th>
                <th style="width: 40%;">شرح السطر</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${dto.items.map((itm: any) => `
                <tr>
                  <td>${itm.account_code || ''}</td>
                  <td>${itm.account_name || ''}</td>
                  <td>${itm.description || ''}</td>
                  <td>${itm.amount || '0.00'}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3">الإجمالي</td>
                <td>${dto.amount || '0.00'}</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <div class="signature-container">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title">توقيع أمين الصندوق</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title">توقيع المستلم</div>
          </div>
        </div>
      `;
      break;
    }

    // Generic / Fallback Report Template
    default: {
      const title = dto.reportTitle || 'تقرير النظام';
      const columns = dto.columns || [];
      const rows = dto.rows || [];
      const totals = dto.totals || {};

      bodyHTML = `
        ${renderHeader(company, title, dto.branchName, dto.userName)}

        <table>
          <thead>
            <tr>
              ${columns.map((col: any) => `<th>${col.label || ''}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row: any) => `
              <tr>
                ${columns.map((col: any) => `<td>${row[col.id] !== undefined ? row[col.id] : ''}</td>`).join('')}
              </tr>
            `).join('')}
            ${Object.keys(totals).length > 0 ? `
              <tr class="total-row">
                ${columns.map((col: any, index: number) => {
                  if (totals[col.id] !== undefined) {
                    return `<td>${totals[col.id]}</td>`;
                  } else if (index === 0) {
                    return `<td>الإجمالي</td>`;
                  } else {
                    return `<td></td>`;
                  }
                }).join('')}
              </tr>
            ` : ''}
          </tbody>
        </table>
      `;
      break;
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${templateName}</title>
      <style>${getGlobalStyles()}</style>
    </head>
    <body>
      ${bodyHTML}
      ${renderFooter()}
    </body>
    </html>
  `;
}

// ----------------------------------------------------
// Puppeteer Compiler
// ----------------------------------------------------

import { execSync } from 'child_process';

function getChromiumExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log('[PDF-GENERATOR] Env PUPPETEER_EXECUTABLE_PATH specified:', process.env.PUPPETEER_EXECUTABLE_PATH);
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log('[PDF-GENERATOR] Found Windows browser path:', p);
        return p;
      }
    }
  } else {
    // Dynamic search using `which` commands as requested
    const commands = ['which chromium', 'which chromium-browser', 'which google-chrome'];
    for (const cmd of commands) {
      try {
        const path = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (path && fs.existsSync(path)) {
          console.log(`[PDF-GENERATOR] Found Chromium/Chrome via command '${cmd}':`, path);
          return path;
        }
      } catch (e) {
        // ignore errors if command is not found or fails
      }
    }

    // Static fallback list if `which` did not find anything
    const paths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log('[PDF-GENERATOR] Found fallback Linux browser path:', p);
        return p;
      }
    }
  }
  console.log('[PDF-GENERATOR] No Chromium/Chrome path found. Falling back to Puppeteer default.');
  return undefined;
}

export async function generatePDF(templateName: string, dto: any): Promise<Buffer> {
  const STEP = '[PDF-GENERATOR]';

  // ── STEP 1: ENTRY ──────────────────────────────────────────────────────────
  console.log(`${STEP} ▶ ENTER generatePDF | file: pdf-generator.ts | fn: generatePDF | template: ${templateName}`);

  // ── STEP 2: READ DATA ──────────────────────────────────────────────────────
  console.log(`${STEP} ▶ Reading DTO data | company: ${dto?.company?.name || 'N/A'} | templateName: ${templateName}`);

  // ── STEP 3: FONT LOADING ───────────────────────────────────────────────────
  const regularPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  const boldPath = path.resolve('./public/fonts/NotoSansArabic-Bold.ttf');
  console.log(`${STEP} ▶ Checking fonts | regularPath: ${regularPath} | boldPath: ${boldPath}`);

  if (!fs.existsSync(regularPath)) {
    const err = new Error(`[pdf-generator.ts] [generatePDF] Font file not found: NotoSansArabic-Regular.ttf (expected at: ${regularPath})`);
    console.error(`${STEP} ❌ FONT NOT FOUND: ${regularPath}`);
    throw err;
  }
  if (!fs.existsSync(boldPath)) {
    const err = new Error(`[pdf-generator.ts] [generatePDF] Font file not found: NotoSansArabic-Bold.ttf (expected at: ${boldPath})`);
    console.error(`${STEP} ❌ FONT NOT FOUND: ${boldPath}`);
    throw err;
  }

  if (!regularFontBase64) {
    regularFontBase64 = fs.readFileSync(regularPath).toString('base64');
    console.log(`${STEP} ✓ Regular font loaded (${regularFontBase64.length} base64 chars)`);
  }
  if (!boldFontBase64) {
    boldFontBase64 = fs.readFileSync(boldPath).toString('base64');
    console.log(`${STEP} ✓ Bold font loaded (${boldFontBase64.length} base64 chars)`);
  }

  // ── STEP 4: BUILD HTML ─────────────────────────────────────────────────────
  console.log(`${STEP} ▶ Building HTML from template: ${templateName}`);
  let html = '';
  try {
    html = generateHTML(templateName, dto);
    console.log(`${STEP} ✓ HTML built successfully | size: ${html.length} chars`);
  } catch (err: any) {
    console.error(`${STEP} ❌ HTML BUILD FAILED | file: pdf-generator.ts | fn: generateHTML | error: ${err.message}`);
    console.error(`${STEP} Stack: ${err.stack}`);
    throw new Error(`[pdf-generator.ts] [generateHTML] Template generation failed for template: "${templateName}". Original error: ${err.message}. Stack: ${err.stack}`);
  }

  // ── STEP 5: CREATE BROWSER ─────────────────────────────────────────────────
  const execPath = getChromiumExecutablePath();
  const execPathExists = execPath ? fs.existsSync(execPath) : false;
  console.log(`${STEP} ▶ Launching Puppeteer browser | executablePath: ${execPath || 'puppeteer default'} | exists: ${execPathExists}`);

  let browser: any = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });
    console.log(`${STEP} ✓ Browser launched successfully`);
  } catch (err: any) {
    console.error(`${STEP} ❌ BROWSER LAUNCH FAILED | file: pdf-generator.ts | fn: generatePDF | line: ~690`);
    console.error(`${STEP}   Chromium path: ${execPath || 'Default Puppeteer'}`);
    console.error(`${STEP}   Chromium exists: ${execPathExists}`);
    console.error(`${STEP}   Error name: ${err.name || 'Error'}`);
    console.error(`${STEP}   Error message: ${err.message}`);
    console.error(`${STEP}   Stack: ${err.stack}`);
    const launchErr = new Error(
      `[pdf-generator.ts] [generatePDF] browser.launch failed.\n` +
      `- Chromium executable path: ${execPath || 'Default Puppeteer'}\n` +
      `- Does Chromium exist? ${execPathExists}\n` +
      `- Exception Name: ${err.name || 'Error'}\n` +
      `- Exception Message: ${err.message}`
    );
    launchErr.stack = err.stack;
    throw launchErr;
  }

  try {
    // ── STEP 6: page.setContent ──────────────────────────────────────────────
    console.log(`${STEP} ▶ Creating new browser page and setting HTML content`);
    let page: any;
    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log(`${STEP} ✓ page.setContent succeeded`);
    } catch (err: any) {
      console.error(`${STEP} ❌ PAGE SETCONTENT FAILED | file: pdf-generator.ts | fn: generatePDF`);
      console.error(`${STEP}   Error name: ${err.name || 'Error'}`);
      console.error(`${STEP}   Error message: ${err.message}`);
      console.error(`${STEP}   Stack: ${err.stack}`);
      const setContentErr = new Error(
        `[pdf-generator.ts] [generatePDF] page.setContent failed.\n` +
        `- browser.launch succeeded? true\n` +
        `- Exception Name: ${err.name || 'Error'}\n` +
        `- Exception Message: ${err.message}`
      );
      setContentErr.stack = err.stack;
      throw setContentErr;
    }

    // ── STEP 7: page.pdf ─────────────────────────────────────────────────────
    console.log(`${STEP} ▶ Generating PDF buffer (A4 format)`);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '10mm',
          bottom: '15mm',
          left: '10mm'
        }
      });
      console.log(`${STEP} ✓ page.pdf succeeded | buffer size: ${pdfBuffer?.length ?? 0} bytes`);
    } catch (err: any) {
      console.error(`${STEP} ❌ PAGE PDF FAILED | file: pdf-generator.ts | fn: generatePDF`);
      console.error(`${STEP}   Error name: ${err.name || 'Error'}`);
      console.error(`${STEP}   Error message: ${err.message}`);
      console.error(`${STEP}   Stack: ${err.stack}`);
      const pdfErr = new Error(
        `[pdf-generator.ts] [generatePDF] page.pdf failed.\n` +
        `- browser.launch succeeded? true\n` +
        `- page.setContent succeeded? true\n` +
        `- Exception Name: ${err.name || 'Error'}\n` +
        `- Exception Message: ${err.message}`
      );
      pdfErr.stack = err.stack;
      throw pdfErr;
    }

    return pdfBuffer;

  } finally {
    // ── STEP 8: CLOSE BROWSER ────────────────────────────────────────────────
    if (browser) {
      try {
        await browser.close();
        console.log(`${STEP} ✓ Browser closed`);
      } catch (err: any) {
        // Log the close error but do NOT throw — the PDF buffer was already returned
        console.error(`${STEP} ⚠ browser.close failed (non-fatal) | ${err.message}`);
      }
    }

    // ── STEP 9: RESPONSE SENT (logged in server.ts handler) ──────────────────
    console.log(`${STEP} ✓ generatePDF complete, returning buffer to caller`);
  }
}
