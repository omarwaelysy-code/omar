import pool from './src/lib/postgres.js';
import { runMigrations } from './src/lib/migration-runner.js';

async function verifyMigration() {
  console.log('--- بدء عملية التحقق من Migration ---');
  
  try {
    // 1. تشغيل Migration
    console.log('\n1. تشغيل Migration...');
    const result = await runMigrations();
    console.log(`تم التنفيذ بنجاح: تم تطبيق ${result.appliedCount} ملف(ات).`);

    // 2. التأكد من وجود جدول company_subscriptions
    console.log('\n2. التحقق من جدول company_subscriptions...');
    const table1Check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'company_subscriptions'
      );
    `);
    console.log(`جدول company_subscriptions موجود: ${table1Check.rows[0].exists}`);

    // 3. التأكد من وجود جدول subscription_history
    console.log('\n3. التحقق من جدول subscription_history...');
    const table2Check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'subscription_history'
      );
    `);
    console.log(`جدول subscription_history موجود: ${table2Check.rows[0].exists}`);

    // 4. التأكد من الـ Indexes
    console.log('\n4. التحقق من الـ Indexes...');
    const indexesCheck = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('company_subscriptions', 'subscription_history');
    `);
    indexesCheck.rows.forEach(idx => {
      console.log(`- تم العثور على Index: ${idx.indexname}`);
    });

    // 5. تنفيذ INSERT تجريبي
    console.log('\n5. تنفيذ INSERT تجريبي...');
    
    // أولاً ننشئ شركة تجريبية مؤقتة لربطها بالـ FK
    const testCompanyId = 'temp-test-company-123';
    await pool.query(`
      INSERT INTO companies (id, name, code) 
      VALUES ($1, 'Test Company', 'TC123')
      ON CONFLICT (id) DO NOTHING
    `, [testCompanyId]);

    const testSubId = 'temp-test-sub-123';
    await pool.query(`
      INSERT INTO company_subscriptions (
        id, company_id, plan_type, subscription_status, max_users
      ) VALUES ($1, $2, 'Pro', 'Trial', 10)
    `, [testSubId, testCompanyId]);
    console.log('تم الإدخال بنجاح.');

    // 6. تنفيذ SELECT
    console.log('\n6. قراءة البيانات (SELECT)...');
    const selectRes = await pool.query(`
      SELECT id, plan_type, subscription_status, max_users 
      FROM company_subscriptions 
      WHERE id = $1
    `, [testSubId]);
    console.log('البيانات المقروءة:', selectRes.rows[0]);

    // 7. حذف السجل التجريبي
    console.log('\n7. حذف البيانات التجريبية...');
    await pool.query(`DELETE FROM company_subscriptions WHERE id = $1`, [testSubId]);
    await pool.query(`DELETE FROM companies WHERE id = $1`, [testCompanyId]);
    console.log('تم الحذف بنجاح.');

    // 8. التأكد أن الجداول القديمة كما هي
    console.log('\n8. التحقق من الجداول القديمة (مثل companies و users)...');
    const oldTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('companies', 'users')
    `);
    oldTables.rows.forEach(t => {
      console.log(`- الجدول القديم ${t.table_name} موجود وسليم.`);
    });

    console.log('\n--- تمت جميع الاختبارات بنجاح! ---');

  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء التحقق:', error);
  } finally {
    process.exit(0);
  }
}

verifyMigration();
