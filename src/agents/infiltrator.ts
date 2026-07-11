import type { Agent, AgentContext, AgentResult } from './types.js';
import { getMatuByteSummary } from '../knowledge/matubyte.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';

export const infiltratorAgent: Agent = {
  id: 'infiltrator',
  name: 'Agente Infiltrado',
  description:
    'Monitorea foros/redes buscando demanda de software y responde con valor MatuByte.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const brand = getMatuByteSummary();
    pushLog({
      level: 'info',
      agentId: this.id,
      message: 'Standby · canal foros/Reddit/FB pendiente de FASE social',
    });
    sendAgentMessage({
      from: 'infiltrator',
      to: 'lead-hunter',
      topic: 'request.niches',
      body: 'Listo para cruzar hilos de demanda con tus nichos calientes',
    });
    ctx.log.info({ agent: this.id, brand: brand.company }, '[stub] infiltrator');
    return {
      status: 'skipped',
      reason: 'phase-social-pending',
      details: { listening: true, brand: brand.company },
    };
  },
};
