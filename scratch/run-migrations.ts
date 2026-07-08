import { runMigrations } from '../src/lib/migration-runner';
async function main() {
  console.log('Starting migration run...');
  try {
    const res = await runMigrations();
    console.log('Result:', res);
  } catch (err) {
    console.error('Migration failed:', err);
  }
  process.exit();
}
main();
