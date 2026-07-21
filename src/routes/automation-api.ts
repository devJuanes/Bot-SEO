import type { FastifyInstance } from 'fastify';
import { compileFlow, type AutomationFlow } from '../services/automation-flow.js';
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationRule,
  listAutomationRules,
  listAutomationRuns,
  updateAutomationRule,
} from '../db/automation.js';

export async function automationApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/automations', async (request, reply) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      try {
        const rules = await listAutomationRules();
        return { rules };
      } catch (err) {
        request.log.warn({ err }, 'automations list failed');
        return reply.code(503).send({
          error:
            'Automatizaciones no disponibles. Ejecuta npm run migrate para crear las tablas.',
          rules: [],
        });
      }
    });
  });

  app.get('/api/automations/runs', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const runs = await listAutomationRuns(40);
      return { runs };
    });
  });

  app.post<{
    Body: {
      name?: string;
      is_enabled?: boolean;
      flow?: AutomationFlow;
      templateId?: string;
    };
  }>('/api/automations', async (request, reply) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    try {
      return await withRequestTenant(request.tenant, async () => {
        const body = request.body ?? {};

        if (!body.flow) {
          return reply.code(400).send({ error: 'flow es requerido' });
        }

        const compiled = compileFlow(body.flow, body.name ?? 'Nuevo flujo');
        const rule = await createAutomationRule({
          ...compiled,
          is_enabled: body.is_enabled !== false,
        });
        return { rule };
      });
    } catch (err) {
      request.log.error({ err }, 'create automation failed');
      const message = err instanceof Error ? err.message : 'Error al crear automatización';
      return reply.code(500).send({ error: message });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      is_enabled?: boolean;
      name?: string;
      flow?: AutomationFlow;
    };
  }>('/api/automations/:id', async (request, reply) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    try {
      return await withRequestTenant(request.tenant, async () => {
        const existing = await getAutomationRule(request.params.id);
        if (!existing) return reply.code(404).send({ error: 'Regla no encontrada' });

        const body = request.body ?? {};
        if (body.flow) {
          const compiled = compileFlow(
            body.flow,
            body.name?.trim() || existing.name,
          );
          const rule = await updateAutomationRule(request.params.id, {
            name: compiled.name,
            is_enabled: body.is_enabled ?? existing.is_enabled,
            trigger_type: compiled.trigger_type,
            trigger_config: compiled.trigger_config,
            conditions: compiled.conditions,
            actions: compiled.actions,
          });
          return { rule };
        }

        const rule = await updateAutomationRule(request.params.id, {
          is_enabled: body.is_enabled,
          name: body.name?.trim(),
        });
        return { rule };
      });
    } catch (err) {
      request.log.error({ err }, 'update automation failed');
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      return reply.code(500).send({ error: message });
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/api/automations/:id',
    async (request, reply) => {
      const { withRequestTenant } = await import('../tenancy/context.js');
      return withRequestTenant(request.tenant, async () => {
        const existing = await getAutomationRule(request.params.id);
        if (!existing) return reply.code(404).send({ error: 'Regla no encontrada' });
        await deleteAutomationRule(request.params.id);
        return { ok: true };
      });
    },
  );
}
