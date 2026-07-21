import type { Lead } from '../db/types.js';
import { chatCompletion, isLlmConfigured } from '../llm/client.js';
import { getProjectSetting } from '../tenancy/store.js';
import { requireProjectId } from '../tenancy/context.js';

export function leadPhoneToWaId(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

export interface LeadProposal {
  id: string;
  label: string;
  tone: 'brand' | 'warning' | 'info' | 'success';
  text: string;
}

function fallbackProposals(lead: Lead, brandName: string): LeadProposal[] {
  const firstName = lead.name.split(/\s+/)[0] || lead.name;
  const sector = lead.business_type || 'su negocio';
  const city = lead.city || 'su ciudad';

  const proposals: LeadProposal[] = [
    {
      id: 'greeting',
      label: 'Saludo inicial',
      tone: 'brand',
      text: `Hola ${firstName}, ¿cómo estás? Soy de ${brandName}. Vi ${lead.name} en Google Maps y me gustaría conocer cómo les va con su presencia digital en ${city}. ¿Tienes un momento para charlar?`,
    },
  ];

  if (lead.needs_website || !lead.website) {
    proposals.push({
      id: 'website',
      label: 'Propuesta web',
      tone: 'warning',
      text: `Hola ${firstName}, en ${brandName} ayudamos a ${sector} como ${lead.name} a tener una web profesional que genere confianza y más clientes. ¿Te gustaría que te comparta una propuesta sin compromiso?`,
    });
  } else {
    proposals.push({
      id: 'improve',
      label: 'Mejora digital',
      tone: 'info',
      text: `Hola ${firstName}, vimos que ${lead.name} ya tiene presencia web. En ${brandName} podemos ayudarles a mejorar conversiones y visibilidad en Google. ¿Te interesa una revisión gratuita?`,
    });
  }

  proposals.push({
    id: 'followup',
    label: 'Seguimiento',
    tone: 'success',
    text: `Hola ${firstName}, solo quería dar seguimiento a mi mensaje anterior. Si te sirve, puedo enviarte una propuesta corta adaptada a ${lead.name}. ¿Cuál es el mejor horario para hablar?`,
  });

  return proposals;
}

export async function generateLeadProposals(lead: Lead): Promise<LeadProposal[]> {
  const projectId = requireProjectId();
  const brandName =
    (await getProjectSetting<string>(projectId, 'brand_name')) || 'MatuByte';

  if (!(await isLlmConfigured())) {
    return fallbackProposals(lead, brandName);
  }

  const opportunity =
    typeof lead.raw_data?.opportunity === 'string'
      ? lead.raw_data.opportunity
      : lead.needs_website
        ? 'needs_website'
        : 'general';

  try {
    const completion = await chatCompletion({
      temperature: 0.75,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content: `Eres copywriter comercial de «${brandName}». Genera mensajes de WhatsApp cortos (máx. 320 caracteres cada uno), en español colombiano, tono cercano y profesional.
Responde SOLO JSON válido: {"proposals":[{"id":"greeting","label":"Saludo inicial","tone":"brand","text":"..."},{"id":"website","label":"Propuesta web","tone":"warning","text":"..."},{"id":"followup","label":"Seguimiento","tone":"success","text":"..."}]}
tone debe ser uno de: brand, warning, info, success.`,
        },
        {
          role: 'user',
          content: `Lead: ${lead.name}
Sector: ${lead.business_type || 'sin dato'}
Ciudad: ${lead.city || 'sin dato'}, ${lead.country || 'CO'}
Teléfono: ${lead.phone || 'sin dato'}
Web: ${lead.website || 'sin web'}
Necesita web: ${lead.needs_website ? 'sí' : 'no'}
Rating Google: ${lead.google_rating ?? 'sin dato'}
Oportunidad: ${opportunity}`,
        },
      ],
    });

    const parsed = JSON.parse(completion.content) as {
      proposals?: LeadProposal[];
    };
    if (Array.isArray(parsed.proposals) && parsed.proposals.length > 0) {
      return parsed.proposals.slice(0, 4).map((p, i) => ({
        id: p.id || `p${i}`,
        label: p.label || `Propuesta ${i + 1}`,
        tone: (['brand', 'warning', 'info', 'success'].includes(p.tone)
          ? p.tone
          : 'brand') as LeadProposal['tone'],
        text: String(p.text || '').trim(),
      })).filter((p) => p.text);
    }
  } catch {
    // fallback below
  }

  return fallbackProposals(lead, brandName);
}
