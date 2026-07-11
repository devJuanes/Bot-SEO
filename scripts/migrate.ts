import 'dotenv/config';
import { ensureSchema } from '../src/db/schema.js';

async function migrate(): Promise<void> {
  console.log('Applying Growth Factory schema to MatuDB...');
  await ensureSchema();
  console.log('Migration completed.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
