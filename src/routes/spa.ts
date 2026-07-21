import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LEGACY_HTML_REDIRECTS: Record<string, string> = {
  '/index.html': '/',
  '/login.html': '/acceso/iniciar-sesion',
  '/whatsapp.html': '/whatsapp/mensajes',
  '/facebook.html': '/facebook',
  '/settings.html': '/settings',
};

const SPA_EXCLUDE_PREFIXES = ['/api/', '/webhooks/', '/health', '/socket.io'];

function shouldServeSpa(url: string): boolean {
  if (url.startsWith('/agents/') && url.endsWith('/run')) return false;
  return !SPA_EXCLUDE_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export async function registerSpaRoutes(app: FastifyInstance): Promise<void> {
  const spaDist = join(__dirname, '..', '..', 'frontend', 'dist');
  const publicDir = join(__dirname, '..', '..', 'public');
  const hasSpaBuild = existsSync(join(spaDist, 'index.html'));

  app.get('/agent.html', async (request, reply) => {
    const id = (request.query as { id?: string }).id;
    if (id) return reply.redirect(`/agents/${encodeURIComponent(id)}`);
    return reply.redirect('/dashboard');
  });

  for (const [from, to] of Object.entries(LEGACY_HTML_REDIRECTS)) {
    // index.html is served by fastify-static — skip duplicate route
    if (from === '/index.html') continue;
    app.get(from, async (_request, reply) => reply.redirect(to));
  }

  if (hasSpaBuild) {
    await app.register(fastifyStatic, {
      root: spaDist,
      prefix: '/',
      wildcard: false,
      index: false,
    });

    app.setNotFoundHandler(async (request, reply) => {
      const url = request.url.split('?')[0] ?? '/';
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return reply.code(404).send({ error: 'Not found' });
      }
      if (!shouldServeSpa(url)) {
        return reply.code(404).send({ error: 'Not found' });
      }
      const legacyPath = join(publicDir, url.replace(/^\//, ''));
      if (
        url !== '/' &&
        existsSync(legacyPath) &&
        statSync(legacyPath).isFile()
      ) {
        return reply.sendFile(url.replace(/^\//, ''), publicDir);
      }
      return reply.sendFile('index.html', spaDist);
    });

    app.log.info({ spaDist }, 'Serving React SPA from frontend/dist');
    return;
  }

  app.log.warn(
    'frontend/dist not found — run npm run build:ui. Falling back to public/ static files.',
  );
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });
}
