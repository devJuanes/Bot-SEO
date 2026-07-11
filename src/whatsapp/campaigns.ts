import {
  addCampaignTargets,
  completeCampaign,
  createCampaign,
  getOrCreateConversation,
  listCampaigns,
  listCampaignTargets,
  markCampaignTargetResult,
  saveMessage,
} from '../db/whatsapp.js';
import { listRecentLeads } from '../db/leads.js';
import { sendTemplateMessage } from './client.js';
import { pushLog, sendAgentMessage } from '../runtime/state.js';

export interface CampaignLeadFilter {
  sector?: string;
  city?: string;
  needsWebsite?: boolean;
}

async function resolveTargets(filter?: CampaignLeadFilter): Promise<
  Array<{ leadId: string; waId: string; name: string; sector: string | null; city: string | null }>
> {
  const leads = await listRecentLeads(300);

  return leads
    .filter((lead) => Boolean(lead.phone))
    .filter((lead) => {
      if (filter?.sector && lead.business_type !== filter.sector) return false;
      if (filter?.city && lead.city !== filter.city) return false;
      if (filter?.needsWebsite !== undefined && lead.needs_website !== filter.needsWebsite) {
        return false;
      }
      return true;
    })
    .map((lead) => ({
      leadId: lead.id,
      waId: (lead.phone ?? '').replace(/\D/g, ''),
      name: lead.name,
      sector: lead.business_type,
      city: lead.city,
    }))
    .filter((t) => t.waId.length >= 10);
}

/** Sustituye placeholders {{name}}/{{sector}}/{{city}} por los datos del lead. */
function fillParams(
  template: string[],
  target: { name: string; sector: string | null; city: string | null },
): string[] {
  return template.map((param) =>
    param
      .replaceAll('{{name}}', target.name)
      .replaceAll('{{sector}}', target.sector ?? 'tu negocio')
      .replaceAll('{{city}}', target.city ?? 'tu ciudad'),
  );
}

export async function launchCampaign(input: {
  name: string;
  templateName: string;
  templateLanguage?: string;
  appSlug?: string;
  bodyParamsTemplate?: string[];
  leadFilter?: CampaignLeadFilter;
  leadIds?: string[];
}): Promise<{ campaignId: string; totalTargets: number }> {
  const allTargets = await resolveTargets(input.leadFilter);
  const targets = input.leadIds?.length
    ? allTargets.filter((t) => input.leadIds!.includes(t.leadId))
    : allTargets;

  if (targets.length === 0) {
    throw new Error('No hay leads con teléfono que coincidan con el filtro.');
  }

  const campaign = await createCampaign({
    name: input.name,
    templateName: input.templateName,
    templateLanguage: input.templateLanguage,
    appSlug: input.appSlug,
  });

  await addCampaignTargets(
    campaign.id,
    targets.map((t) => ({ leadId: t.leadId, waId: t.waId })),
  );

  pushLog({
    level: 'info',
    agentId: 'whatsapp-campaign',
    message: `Campaña "${input.name}" → ${targets.length} destinatarios`,
  });

  // Background send loop — respond to the caller immediately, keep sending with delay.
  void runCampaignLoop(campaign.id, targets, input.bodyParamsTemplate ?? []);

  return { campaignId: campaign.id, totalTargets: targets.length };
}

async function runCampaignLoop(
  campaignId: string,
  targets: Array<{ leadId: string; waId: string; name: string; sector: string | null; city: string | null }>,
  bodyParamsTemplate: string[],
): Promise<void> {
  const pending = await listCampaignTargets(campaignId);
  const byWaId = new Map(targets.map((t) => [t.waId, t]));

  const campaigns = await listCampaigns(100);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  for (const target of pending) {
    const info = byWaId.get(target.wa_id);
    if (!info) continue;

    try {
      const params = fillParams(bodyParamsTemplate, info);
      const result = await sendTemplateMessage(
        target.wa_id,
        campaign.template_name,
        campaign.template_language,
        params,
      );

      const conversation = await getOrCreateConversation({
        waId: target.wa_id,
        profileName: info.name,
      });

      await saveMessage({
        conversationId: conversation.id,
        waMessageId: result.waMessageId,
        direction: 'outbound',
        senderType: 'bot',
        content: `[Plantilla enviada: ${params.join(' · ')}]`,
        messageType: 'template',
      });

      await markCampaignTargetResult(target.id, campaignId, true);
    } catch (err) {
      await markCampaignTargetResult(
        target.id,
        campaignId,
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Respect WhatsApp rate limits — small delay between sends.
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  await completeCampaign(campaignId);
  sendAgentMessage({
    from: 'whatsapp-campaign',
    to: 'broadcast',
    topic: 'whatsapp.campaign_completed',
    body: `Campaña completada: ${pending.length} envíos procesados`,
    payload: { campaignId },
  });
}
