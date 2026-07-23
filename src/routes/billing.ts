import type { FastifyInstance } from 'fastify';
import {
  completePaidSignup,
  PLANS,
  startPaidSignup,
  validateInvitationCode,
} from '../services/billing.js';
import { getPaymentStatus, isPaidStatus } from '../services/paymatubyte.js';
import { setAuthCookie } from '../tenancy/auth.js';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/billing/plans', async () => ({
    plans: Object.values(PLANS),
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Multi-proyecto, SLA y onboarding asistido — habla con ventas',
      contactUrl: 'https://growth.matubyte.com/contacto',
    },
  }));

  app.post('/api/billing/validate-invite', async (request, reply) => {
    const body = (request.body ?? {}) as { code?: string };
    if (!body.code?.trim()) {
      return reply.code(400).send({ error: 'code is required' });
    }
    const result = await validateInvitationCode(body.code);
    return result;
  });

  app.post('/api/billing/checkout', async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      name?: string;
      organizationName?: string;
    };

    if (!body.email || !body.password || !body.name) {
      return reply.code(400).send({ error: 'email, password and name are required' });
    }
    if (body.password.length < 8) {
      return reply.code(400).send({ error: 'password must be at least 8 characters' });
    }

    try {
      const result = await startPaidSignup({
        email: body.email,
        password: body.password,
        name: body.name,
        organizationName: body.organizationName,
      });
      return { checkoutUrl: result.checkoutUrl, reference: result.reference };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already registered/i.test(message)) {
        return reply.code(409).send({ error: 'Este correo ya está registrado' });
      }
      request.log.error({ err }, 'checkout failed');
      return reply.code(500).send({ error: message });
    }
  });

  app.post('/api/billing/complete', async (request, reply) => {
    const body = (request.body ?? {}) as { reference?: string };
    if (!body.reference?.trim()) {
      return reply.code(400).send({ error: 'reference is required' });
    }

    try {
      const result = await completePaidSignup(body.reference.trim());
      setAuthCookie(reply, result.token);
      return {
        user: result.user,
        organization: result.organization,
        project: result.project,
        token: result.token,
        plan: 'plan-pro',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'ALREADY_COMPLETED'
      ) {
        const token = (err as { token?: string }).token;
        if (token) setAuthCookie(reply, token);
        return {
          alreadyCompleted: true,
          token,
        };
      }
      if (/no ha sido confirmado/i.test(message)) {
        return reply.code(402).send({ error: message, paid: false });
      }
      if (/no encontrado/i.test(message)) {
        return reply.code(404).send({ error: message });
      }
      request.log.error({ err }, 'complete signup failed');
      return reply.code(500).send({ error: message });
    }
  });

  app.get('/api/billing/status/:reference', async (request, reply) => {
    const { reference } = request.params as { reference: string };
    if (!reference?.trim()) {
      return reply.code(400).send({ error: 'reference is required' });
    }
    try {
      const status = await getPaymentStatus(reference.trim());
      return {
        reference: status.reference,
        status: status.status,
        paid: isPaidStatus(status.status),
        transaction_id: status.transaction_id ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: message });
    }
  });
}
