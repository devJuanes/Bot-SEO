import 'dotenv/config';
import { ensureSchema } from '../src/db/schema.js';
import { pingDatabase } from '../src/db/matu.js';
import { env } from '../src/config/env.js';

async function migrate(): Promise<void> {
  console.log(`Applying Growth Factory schema to MatuDB (${env.MATUDB_URL})…`);
  console.log('Comprobando conexión (hasta 5 reintentos si la red falla)…');
  const ping = await pingDatabase();
  if (!ping.ok) {
    console.error('MatuDB no respondió tras varios intentos:', ping.error);
    if (ping.error?.toLowerCase().includes('fetch failed')) {
      console.error(
        'Esto suele ser un fallo de red momentáneo, no credenciales incorrectas.',
      );
      console.error('Si la app ya muestra datos, vuelve a ejecutar: npm run migrate');
    } else {
      console.error('Verifica MATUDB_URL, MATUDB_PROJECT_ID y MATUDB_API_KEY en .env');
    }
    process.exit(1);
  }
  await ensureSchema();
  console.log('Migration completed.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
