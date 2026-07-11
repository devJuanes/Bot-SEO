import { blogWriterAgent } from './blog-writer.js';
import { communityAgentAgent } from './community-agent.js';
import { contentRadarAgent } from './content-radar.js';
import { infiltratorAgent } from './infiltrator.js';
import { leadHunterAgent } from './lead-hunter/index.js';
import { opportunityScoutAgent } from './opportunity-scout/index.js';
import { socialCreatorAgent } from './social-creator.js';
import type { Agent, AgentContext, AgentId, AgentResult } from './types.js';

const agents: Agent[] = [
  leadHunterAgent,
  opportunityScoutAgent,
  infiltratorAgent,
  contentRadarAgent,
  blogWriterAgent,
  socialCreatorAgent,
  communityAgentAgent,
];

const agentsById = new Map<AgentId, Agent>(
  agents.map((agent) => [agent.id, agent]),
);

export function listAgents(): Agent[] {
  return [...agents];
}

export function getAgent(id: string): Agent | undefined {
  return agentsById.get(id as AgentId);
}

export async function runAgent(
  id: string,
  ctx: AgentContext,
): Promise<{ agent: Agent; result: AgentResult }> {
  const agent = getAgent(id);
  if (!agent) {
    throw new Error(`Unknown agent id: ${id}`);
  }

  const result = await agent.run(ctx);
  return { agent, result };
}
