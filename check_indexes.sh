#!/bin/bash
echo "=== INDEXES ON payment_vouchers ==="
docker exec erp-postgres psql -U postgres -d cloud_erp_system -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='payment_vouchers';"

echo "=== INDEXES ON receipt_vouchers ==="
docker exec erp-postgres psql -U postgres -d cloud_erp_system -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='receipt_vouchers';"

echo "=== document_sequences for payment_vouchers ==="
docker exec erp-postgres psql -U postgres -d cloud_erp_system -c "SELECT company_id, module, period, last_seq FROM document_sequences WHERE module='payment_vouchers' ORDER BY company_id, period;"

echo "=== Aug 2026 payment_vouchers ==="
docker exec erp-postgres psql -U postgres -d cloud_erp_system -c "SELECT id, voucher_number, company_id, created_at FROM payment_vouchers WHERE voucher_number LIKE 'PV-2026-08%' ORDER BY company_id, voucher_number;"

echo "=== journal_entries for Aug 2026 payment ==="
docker exec erp-postgres psql -U postgres -d cloud_erp_system -c "SELECT id, entry_number, reference_type, reference_number, company_id FROM journal_entries WHERE reference_type='payment' ORDER BY company_id, entry_number LIMIT 10;"
