import { launchBrowser } from '../src/browser/playwright.js';

async function main(): Promise<void> {
  const session = await launchBrowser({ headless: true });
  try {
    await session.page.goto('about:blank');
    console.log('playwright_ok', await session.browser.version());
  } finally {
    await session.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
