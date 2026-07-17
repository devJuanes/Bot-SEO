/**
 * Smoke offline del catálogo + rotación editorial (sin LLM / sin publicar).
 *
 *   npx tsx scripts/smoke-editorial.ts
 */
import assert from 'node:assert/strict';
import {
  PRODUCT_CATALOG,
  formatCatalogForPrompt,
  getCatalogEntry,
} from '../src/knowledge/product-catalog.js';
import {
  diversifyPillarBatch,
  pickCatalogProduct,
  pickWeightedPillar,
  shouldIncludeProductCta,
} from '../src/knowledge/editorial.js';
import { listAgents, getAgent } from '../src/agents/registry.js';

function main(): void {
  console.log('▶ smoke-editorial');

  const required = [
    'matucourse',
    'parking',
    'cmr',
    'matusendmail',
    'matupdf',
    'ebook-app',
    'matucash',
    'matupicks',
    'matudb',
    'custom-dev',
    'fymapp',
  ];
  for (const slug of required) {
    const entry = getCatalogEntry(slug);
    assert.ok(entry, `missing catalog entry: ${slug}`);
  }

  const fym = getCatalogEntry('fymapp')!;
  assert.equal(fym.ownership, 'partner');
  assert.ok(fym.partnerNote && /no.*MatuByte|no es/i.test(fym.partnerNote));

  const owned = PRODUCT_CATALOG.filter((p) => p.ownership === 'matubyte');
  assert.ok(owned.length >= 8, 'expected ≥8 MatuByte products');

  const prompt = formatCatalogForPrompt();
  assert.ok(prompt.includes('FymApp'));
  assert.ok(prompt.includes('ALIADO') || prompt.includes('aliado'));

  const pillars = diversifyPillarBatch(6, ['commercial']);
  assert.equal(pillars.length, 6);
  const commercial = pillars.filter((p) => p === 'commercial').length;
  assert.ok(commercial <= 1, `too many commercial pillars: ${commercial}`);
  const eduish = pillars.filter((p) => p === 'education' || p === 'general').length;
  assert.ok(eduish >= 3, `expected majority edu/general, got ${eduish}`);

  const recent = ['cmr', 'matudb', 'matucourse'];
  const pick = pickCatalogProduct({ recentSlugs: recent, pillar: 'education' });
  assert.ok(!recent.includes(pick.slug), `should avoid recent slug, got ${pick.slug}`);

  let ctaHits = 0;
  for (let i = 0; i < 40; i += 1) {
    const pillar = pickWeightedPillar([]);
    if (shouldIncludeProductCta(pillar, () => 0.99) && pillar === 'education') {
      // forced high rng on education still often false — just exercise path
    }
    if (shouldIncludeProductCta('commercial', () => 0.1)) ctaHits += 1;
  }
  assert.equal(ctaHits, 40, 'commercial pillar always includes CTA');

  const agents = listAgents().map((a) => a.id);
  assert.ok(agents.includes('catalog-curator'));
  assert.ok(agents.includes('editorial-planner'));
  assert.ok(getAgent('catalog-curator'));
  assert.ok(getAgent('editorial-planner'));

  console.log('✓ catalog entries:', PRODUCT_CATALOG.length);
  console.log('✓ pillars sample:', pillars.join(', '));
  console.log('✓ rotated product:', pick.slug);
  console.log('✓ agents registered:', agents.length);
  console.log('OK smoke-editorial');
}

main();
