import { logAgentRun } from '../../db/leads.js';
import { upsertOpportunity } from '../../db/growth.js';
import { pushLog } from '../../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { scoutOpportunitySources } from './scout.js';

export const opportunityScoutAgent: Agent = {
  id: 'opportunity-scout',
  name: 'Agente Scout de Oportunidades',
  description:
    'Busca demanda en empleos, SECOP/alcaldías y foros/Reddit para soluciones de software.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    pushLog({
      level: 'info',
      agentId: this.id,
      message: 'Scouting jobs / gov / forums…',
    });

    try {
      const hits = await scoutOpportunitySources({
        headless: ctx.env.HEADLESS_MODE,
        maxPerQuery: 5,
      });

      let inserted = 0;
      let duplicates = 0;

      for (const hit of hits) {
        const { action } = await upsertOpportunity({
          external_id: hit.externalId,
          source: hit.source,
          opportunity_type: hit.opportunityType,
          title: hit.title,
          company_name: hit.companyName,
          description: hit.description,
          city: hit.city,
          country: hit.country ?? 'CO',
          source_url: hit.sourceUrl,
          needs_software: true,
          score: hit.opportunityType === 'gov' ? 70 : 55,
          tags: [hit.opportunityType, hit.source],
          raw_data: { scraped_at: new Date().toISOString() },
        });

        if (action === 'inserted') {
          inserted += 1;
          pushLog({
            level: 'success',
            agentId: this.id,
            message: `Opp · ${hit.opportunityType} · ${hit.title.slice(0, 80)}`,
          });
        } else {
          duplicates += 1;
        }
      }

      const result: AgentResult = {
        status: 'ok',
        reason: `Scouted ${hits.length} · ${inserted} nuevas · ${duplicates} dupes`,
        details: { scanned: hits.length, inserted, duplicates },
      };

      await logAgentRun({
        agent_id: this.id,
        triggered_by: ctx.triggeredBy,
        status: result.status,
        reason: result.reason,
        details: result.details,
        started_at: startedAt,
      }).catch(() => undefined);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: AgentResult = { status: 'error', reason: message };
      await logAgentRun({
        agent_id: this.id,
        triggered_by: ctx.triggeredBy,
        status: 'error',
        reason: message,
        started_at: startedAt,
      }).catch(() => undefined);
      return result;
    }
  },
};
