import mysql.connector
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# MySQL Connection (Source)
mysql_conn = mysql.connector.connect(
    host=os.getenv('MYSQL_HOST', 'localhost'),
    user=os.getenv('MYSQL_USER', 'root'),
    password=os.getenv('MYSQL_PASSWORD', ''),
    database=os.getenv('MYSQL_NAME', 'cloud_erp_system')
)
mysql_cursor = mysql_conn.cursor(dictionary=True)

# PostgreSQL Connection (Destination)
pg_conn = psycopg2.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', ''),
    dbname=os.getenv('DB_NAME', 'cloud_erp_system'),
    port=os.getenv('DB_PORT', '5432')
)
pg_cursor = pg_conn.cursor()

tables = [
    'companies', 'roles', 'users', 'account_types', 'accounts', 
    'customers', 'suppliers', 'products', 'invoices', 'invoice_items',
    'journal_entries', 'journal_entry_lines', 'payment_methods', 'activity_logs'
]

def migrate_table(table_name):
    print(f"Migrating table: {table_name}...")
    
    # Fetch from MySQL
    mysql_cursor.execute(f"SELECT * FROM {table_name}")
    rows = mysql_cursor.fetchall()
    
    if not rows:
        print(f"No data in {table_name}.")
        return

    # Prepare PG Insert
    columns = rows[0].keys()
    placeholders = ", ".join(["%s"] * len(columns))
    col_names = ", ".join(columns)
    insert_query = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    
    data_to_insert = [tuple(row.values()) for row in rows]
    
    try:
        pg_cursor.executemany(insert_query, data_to_insert)
        pg_conn.commit()
        print(f"Successfully migrated {len(rows)} rows to {table_name}.")
    except Exception as e:
        pg_conn.rollback()
        print(f"Error migrating {table_name}: {e}")

for table in tables:
    migrate_table(table)

mysql_cursor.close()
mysql_conn.close()
pg_cursor.close()
pg_conn.close()

print("Migration completed.")
