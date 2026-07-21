import type { FastifyInstance } from 'fastify';
import { createContactSubmission } from '../db/contact.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contactApiRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      name?: string;
      email?: string;
      company?: string;
      phone?: string;
      message?: string;
      sourcePage?: string;
    };
  }>('/api/public/contact', async (request, reply) => {
    const body = request.body ?? {};
    const name = body.name?.trim();
    const email = body.email?.trim();
    const message = body.message?.trim();

    if (!name || name.length < 2) {
      return reply.code(400).send({ error: 'Nombre requerido (mín. 2 caracteres)' });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'Email inválido' });
    }
    if (!message || message.length < 10) {
      return reply.code(400).send({ error: 'Mensaje requerido (mín. 10 caracteres)' });
    }

    try {
      const submission = await createContactSubmission({
        name,
        email,
        company: body.company,
        phone: body.phone,
        message,
        sourcePage: body.sourcePage,
      });
      return { ok: true, id: submission.id };
    } catch (err) {
      request.log.error({ err }, 'contact submission failed');
      return reply.code(500).send({ error: 'No se pudo guardar el mensaje' });
    }
  });
}
