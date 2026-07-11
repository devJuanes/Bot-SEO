import type { FastifyInstance } from 'fastify';
import { getAgent, listAgents } from '../agents/registry.js';
import type { AgentId } from '../agents/types.js';
import { executeAgent } from '../runtime/orchestrator.js';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/agents', async () => {
    return {
      agents: listAgents().map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),
    };
  });

  app.post<{
    Params: { id: string };
    Body: Record<string, unknown> | undefined;
  }>('/agents/:id/run', async (request, reply) => {
    const { id } = request.params;
    const agent = getAgent(id);

    if (!agent) {
      return reply.code(404).send({
        error: 'Agent not found',
        id,
      });
    }

    const body =
      request.body && typeof request.body === 'object' ? request.body : {};

    try {
      const { result } = await executeAgent(
        id as AgentId,
        request.log,
        'manual',
        body,
      );

      return {
        agent: {
          id: agent.id,
          name: agent.name,
        },
        triggeredBy: 'manual',
        result,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(409).send({ error: message });
    }
  });
}
