import type { FastifyInstance } from 'fastify';
import { getLeadById, getLeadStats, listLeadsPaginated } from '../db/leads.js';

export async function leadsApiRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      search?: string;
      status?: string;
      source?: string;
    };
  }>('/api/leads', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 25)));
      const offset = Math.max(0, Number(request.query.offset ?? 0));
      return listLeadsPaginated({
        limit,
        offset,
        search: request.query.search,
        status: request.query.status,
        source: request.query.source,
      });
    });
  });

  app.get('/api/leads/stats', async (request) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => getLeadStats());
  });

  app.get<{ Params: { id: string } }>('/api/leads/:id', async (request, reply) => {
    const { withRequestTenant } = await import('../tenancy/context.js');
    return withRequestTenant(request.tenant, async () => {
      const lead = await getLeadById(request.params.id);
      if (!lead) return reply.code(404).send({ error: 'Lead no encontrado' });
      return { lead };
    });
  });
}
