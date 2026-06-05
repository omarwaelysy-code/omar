import pool from './src/lib/postgres';
async function test() {
  try {
    const { rows: receiptCols } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'receipt_vouchers'"
    );
    console.log("receipt_vouchers columns:", receiptCols.map(c => `${c.column_name} (${c.data_type})`));
    
    const { rows: paymentCols } = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payment_vouchers'"
    );
    console.log("payment_vouchers columns:", paymentCols.map(c => `${c.column_name} (${c.data_type})`));
  } catch(e) { 
    console.error(e); 
  }
  process.exit();
}
test();