import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { env } from '../config/env.js';

export interface LaunchBrowserOptions {
  /** Only honored in non-production when HEADLESS_MODE=false */
  headless?: boolean;
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

function resolveHeadless(override?: boolean): boolean {
  // Servers / production never open a visible browser window.
  if (env.NODE_ENV === 'production') return true;
  if (override !== undefined) return override;
  return env.HEADLESS_MODE;
}

/**
 * Launches Chromium. Headless by default — safe for Linux console servers without GUI.
 */
export async function launchBrowser(
  options: LaunchBrowserOptions = {},
): Promise<BrowserSession> {
  const headless = resolveHeadless(options.headless);

  const browser = await chromium.launch({
    headless,
    args: headless
      ? ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
      : [],
  });

  const context = await browser.newContext({
    locale: 'es-CO',
    viewport: { width: 1280, height: 720 },
  });
  context.setDefaultTimeout(25_000);
  context.setDefaultNavigationTimeout(45_000);

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    },
  };
}
