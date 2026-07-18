import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Finding duplicate purchase invoice numbers...');
    const duplicates = await client.query(`
      SELECT company_id, invoice_number, COUNT(*) as count
      FROM purchase_invoices
      GROUP BY company_id, invoice_number
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length === 0) {
      console.log('No duplicates found!');
    } else {
      console.log('Found duplicates:', duplicates.rows);

      for (const dup of duplicates.rows) {
        const companyId = dup.company_id;
        const invoiceNumber = dup.invoice_number;

        // Get the invoices with this duplicate number, ordered by created_at (keep the oldest one as is)
        const invoices = await client.query(`
          SELECT id, date, created_at
          FROM purchase_invoices
          WHERE company_id = $1 AND invoice_number = $2
          ORDER BY created_at ASC
        `, [companyId, invoiceNumber]);

        // Keep the first one, modify the rest
        for (let i = 1; i < invoices.rows.length; i++) {
          const inv = invoices.rows[i];
          const period = inv.date.slice(0, 7); // YYYY-MM
          
          // Get the actual max sequence for this period to avoid future conflicts
          let currentMax = 0;
          const maxRes = await client.query(`
            SELECT MAX(CAST(SUBSTRING(invoice_number FROM 14) AS INTEGER)) as max_seq
            FROM purchase_invoices
            WHERE company_id = $1 AND invoice_number LIKE $2
          `, [companyId, `PINV-${period}-%`]);
          
          if (maxRes.rows[0].max_seq) {
            currentMax = maxRes.rows[0].max_seq;
          }

          const nextSeq = currentMax + 1;
          const newInvoiceNumber = `PINV-${period}-${String(nextSeq).padStart(6, '0')}`;

          console.log(`Fixing invoice ${inv.id}: changing ${invoiceNumber} to ${newInvoiceNumber}`);

          await client.query('BEGIN');

          // Update purchase_invoices
          await client.query(`
            UPDATE purchase_invoices
            SET invoice_number = $1
            WHERE id = $2
          `, [newInvoiceNumber, inv.id]);

          // Update journal_entries
          await client.query(`
            UPDATE journal_entries
            SET reference_number = $1
            WHERE reference_type = 'purchase_invoice' AND reference_id = $2
          `, [newInvoiceNumber, inv.id]);

          // Update purchase_orders
          await client.query(`
            UPDATE purchase_orders
            SET invoice_number = $1
            WHERE invoice_id = $2
          `, [newInvoiceNumber, inv.id]);

          await client.query('COMMIT');

          // Update document_sequences so it knows the new max
          await client.query(`
            INSERT INTO document_sequences (id, company_id, module, period, last_seq, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, 'purchase_invoices', $2, $3, NOW(), NOW())
            ON CONFLICT (company_id, module, period)
            DO UPDATE SET last_seq = GREATEST(document_sequences.last_seq, $3), updated_at = NOW()
          `, [companyId, period, nextSeq]);
        }
      }
    }

    // Sync all max sequences for purchase_invoices to be safe
    console.log('Syncing document_sequences for purchase_invoices...');
    const periods = await client.query(`
      SELECT company_id, SUBSTRING(date FROM 1 FOR 7) as period, MAX(CAST(SUBSTRING(invoice_number FROM 14) AS INTEGER)) as max_seq
      FROM purchase_invoices
      WHERE invoice_number LIKE 'PINV-%'
      GROUP BY company_id, SUBSTRING(date FROM 1 FOR 7)
    `);

    for (const p of periods.rows) {
      await client.query(`
        INSERT INTO document_sequences (id, company_id, module, period, last_seq, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, 'purchase_invoices', $2, $3, NOW(), NOW())
        ON CONFLICT (company_id, module, period)
        DO UPDATE SET last_seq = GREATEST(document_sequences.last_seq, $3), updated_at = NOW()
      `, [p.company_id, p.period, p.max_seq]);
    }
    console.log('Sync complete.');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
