import { config } from 'dotenv';
import { createClient } from '@devjuanes/matuclient';

config();

const db = createClient({
  url: process.env.MATUDB_URL,
  projectId: process.env.MATUDB_PROJECT_ID,
  apiKey: process.env.MATUDB_API_KEY,
});

const { data, error } = await db.from('invitation_codes').select('code,plan,used_count,max_uses').limit(5);
if (error) {
  console.error('ERROR:', error);
  process.exit(1);
}
console.log('invitation_codes:', JSON.stringify(data, null, 2));
