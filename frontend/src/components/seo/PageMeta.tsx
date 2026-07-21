import { useEffect } from 'react';

const SITE_NAME = 'MatuByte Growth Factory';
const SITE_URL = 'https://growth.matubyte.com';

export interface PageMetaProps {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function PageMeta({
  title,
  description,
  path = '/',
  type = 'website',
  jsonLd,
}: PageMetaProps): null {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;

  useEffect(() => {
    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:locale', 'es_CO');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertLink('canonical', url);
  }, [fullTitle, description, type, url]);

  useEffect(() => {
    if (!jsonLd) return;
    const id = 'page-jsonld';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
    return () => {
      script?.remove();
    };
  }, [jsonLd]);

  return null;
}

export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MatuByte S.A.S.',
  url: 'https://matubyte.com',
  logo: 'https://growth.matubyte.com/favicon.ico',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Cali',
    addressCountry: 'CO',
  },
  sameAs: [
    'https://www.facebook.com/matubyte',
    'https://www.instagram.com/matubyte',
    'https://www.linkedin.com/company/matubyte',
  ],
};

export const SOFTWARE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MatuByte Growth Factory',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Prueba gratuita sin tarjeta',
  },
  description:
    'Plataforma SaaS multi-tenant con agentes de IA para prospección, WhatsApp, Facebook, automatizaciones y monitor en vivo.',
  provider: {
    '@type': 'Organization',
    name: 'MatuByte S.A.S.',
    url: 'https://matubyte.com',
  },
};
