import { logAgentRun, upsertLead } from '../../db/leads.js';
import { getMatuByteSummary } from '../../knowledge/matubyte.js';
import { pushLog, sendAgentMessage } from '../../runtime/state.js';
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { scrapeGoogleMapsPlaces } from './maps-scraper.js';

function resolveHunterParams(ctx: AgentContext): {
  query: string;
  city: string;
  sector?: string;
  country: string;
  countryCode: string;
  maxResults: number;
} {
  const params = ctx.params ?? {};
  const city =
    (typeof params.city === 'string' && params.city) ||
    ctx.env.LEAD_HUNTER_CITY;
  const sector =
    (typeof params.sector === 'string' && params.sector) ||
    ctx.env.LEAD_HUNTER_SECTOR ||
    undefined;
  const country =
    (typeof params.country === 'string' && params.country) || 'Colombia';
  const countryCode =
    (typeof params.countryCode === 'string' && params.countryCode) || 'CO';
  const query =
    (typeof params.query === 'string' && params.query) ||
    ctx.env.LEAD_HUNTER_QUERY ||
    (sector ? `${sector} ${city} ${country}` : `negocios ${city} ${country}`);
  const maxResultsRaw =
    typeof params.maxResults === 'number'
      ? params.maxResults
      : ctx.env.LEAD_HUNTER_MAX_RESULTS;

  return {
    query,
    city,
    sector,
    country,
    countryCode,
    maxResults: Math.min(Math.max(maxResultsRaw, 1), 40),
  };
}

export const leadHunterAgent: Agent = {
  id: 'lead-hunter',
  name: 'Agente Cazador de Leads',
  description:
    'Escanea Google Maps (CO + LatAm) buscando negocios sin web / oportunidad software y los inserta en MatuDB sin duplicados.',
  async run(ctx: AgentContext): Promise<AgentResult> {
    const startedAt = new Date().toISOString();
    const brand = getMatuByteSummary();
    const { query, city, sector, country, countryCode, maxResults } =
      resolveHunterParams(ctx);

    pushLog({
      level: 'info',
      agentId: this.id,
      message: `Scanning Maps · ${query}`,
      details: { brand: brand.company, city, country, sector },
    });

    ctx.log.info(
      { agent: this.id, query, city, sector, country, maxResults },
      'Lead hunter starting Google Maps scan',
    );

    try {
      const places = await scrapeGoogleMapsPlaces({
        query,
        city,
        sector,
        maxResults,
        headless: ctx.env.HEADLESS_MODE,
      });

      let inserted = 0;
      let duplicates = 0;
      let withWebsite = 0;
      let needsWebsite = 0;
      const saved: Array<{
        name: string;
        needs_website: boolean;
        action: string;
        city: string;
      }> = [];

      for (const place of places) {
        const hasWebsite = Boolean(place.website);
        if (hasWebsite) {
          withWebsite += 1;
          // Still store opportunity-rich businesses? User asked for needs_website focus.
          // Keep only no-website for commercial prospecting flag.
          continue;
        }

        needsWebsite += 1;
        pushLog({
          level: 'info',
          agentId: this.id,
          message: `Lead candidate · ${place.name} (${city})`,
        });

        const { action, lead } = await upsertLead({
          external_id: place.externalId,
          source: 'google_maps',
          name: place.name,
          business_type: sector ?? null,
          city,
          country: countryCode,
          address: place.address,
          phone: place.phone,
          website: null,
          needs_website: true,
          google_maps_url: place.mapsUrl,
          google_rating: place.rating,
          google_reviews_count: place.reviewsCount,
          latitude: place.latitude,
          longitude: place.longitude,
          status: 'new',
          tags: [sector, city, country, 'needs_website'].filter(Boolean) as string[],
          raw_data: {
            query,
            country_name: country,
            scraped_at: new Date().toISOString(),
            opportunity: 'website_or_app',
          },
        });

        if (action === 'inserted') {
          inserted += 1;
          sendAgentMessage({
            from: 'lead-hunter',
            to: 'broadcast',
            topic: 'leads.created',
            body: `${lead.name}${city ? ` · ${city}` : ''}`,
            payload: {
              leadId: lead.id,
              name: lead.name,
              city,
              phone: lead.phone,
              status: lead.status,
            },
          });
        } else duplicates += 1;

        saved.push({
          name: lead.name,
          needs_website: true,
          action,
          city,
        });
      }

      const result: AgentResult = {
        status: 'ok',
        reason: `Scanned ${places.length} · ${needsWebsite} sin web · ${inserted} nuevos · ${duplicates} dupes evitados`,
        details: {
          query,
          city,
          country,
          countryCode,
          sector: sector ?? null,
          scanned: places.length,
          withWebsite,
          needsWebsite,
          inserted,
          duplicates,
          saved,
        },
      };

      await logAgentRun({
        agent_id: this.id,
        triggered_by: ctx.triggeredBy,
        status: result.status,
        reason: result.reason,
        details: result.details,
        started_at: startedAt,
      }).catch((err) => {
        ctx.log.warn({ err }, 'Failed to persist agent_runs row');
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.log.error({ err, agent: this.id }, 'Lead hunter failed');

      const result: AgentResult = {
        status: 'error',
        reason: message,
      };

      await logAgentRun({
        agent_id: this.id,
        triggered_by: ctx.triggeredBy,
        status: result.status,
        reason: result.reason,
        started_at: startedAt,
      }).catch(() => undefined);

      return result;
    }
  },
};
