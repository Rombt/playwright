import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

import { IBrowser as IBrowser } from '../IBrowser';
import {
  chromium,
  Browser as PWBrowser,
  BrowserContext,
  LaunchOptions,
  BrowserContextOptions,
  Download,
  Page,
} from 'playwright';
import { FingerprintPool } from '../fingerprint/FingerprintPool';
import { ILogger } from '../../data/logger/types/ILogger';

export class PlaywrightBrowser
  implements IBrowser<PWBrowser, BrowserContext, LaunchOptions, BrowserContextOptions>
{
  private instance: PWBrowser | null = null;

  constructor(
    private readonly launchOptions: LaunchOptions,
    private readonly browserContextOptions: BrowserContextOptions,
  ) {}

  public get isInitialized(): boolean {
    return this.instance !== null;
  }

  async init(): Promise<PWBrowser> {
    if (this.isInitialized) return this.instance!;
    this.instance = await chromium.launch(this.launchOptions);
    return this.instance;
  }

  async close(): Promise<void> {
    if (!this.instance) return;

    try {
      for (const context of this.instance.contexts()) {
        try {
          await context.close();
        } catch (err) {
          console.warn('Error closing context:', err);
        }
      }
    } catch (err) {
      console.warn('Error closing browser:', err);
    } finally {
      await this.instance.close();
      this.instance = null;
    }

    console.log('Browser closed.');
  }

  async createContext(mode: 'real' | 'fake' = 'real'): Promise<BrowserContext> {
    const browser = await this.init();

    if (mode === 'fake') {
      const fingerprintPool = new FingerprintPool();
      const fingerprint = fingerprintPool.get();

      if (!fingerprint) {
        throw new Error('Нет доступного fingerprint профиля');
      }

      return browser.newContext({
        ...this.browserContextOptions,
        ...fingerprint,
      });
    }

    return browser.newContext(this.browserContextOptions);
  }

  async runInContext<Result>(
    fn: (context: BrowserContext) => Promise<Result>,
    mode?: 'real' | 'fake',
  ): Promise<Result> {
    const context = await this.createContext(mode);

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    try {
      return await fn(context);
    } finally {
      await context.close();
    }
  }

  async runInContextByChromium<Result>(
    fn: (context: BrowserContext) => Promise<Result>,
    mode?: 'real' | 'fake',
    loggerScope?: ILogger,
  ): Promise<Result> {
    loggerScope?.debug('The enter to the runInContextByChromium', {
      component: 'PlaywrightBrowser',
      method: 'runInContextByChromium',
      stage: 'init',
      data: {},
    });

    const baseDir = path.resolve('./browser-profiles/chrome-profiles');
    await fs.mkdir(baseDir, { recursive: true });
    const profileDir = path.join(baseDir, `chrome-profile-${crypto.randomUUID()}`);

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled'],
    });

    loggerScope?.debug('Context is received', {
      component: 'PlaywrightBrowser',
      method: 'runInContextByChromium',
      stage: 'init',
      data: {
        context: context,
      },
    });

    try {
      return await fn(context);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      loggerScope?.error('Problems with browser context', {
        component: 'PlaywrightBrowser',
        method: 'runInContextByChromium',
        action: 'return await fn(context);',
        data: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
      throw error;
    } finally {
      await context.close();
      await fs.rm(profileDir, {
        recursive: true,
        force: true,
      });
    }
  }

  async download(page: Page, url: string): Promise<{ buffer: Buffer; ext: string }> {
    let downloadEvent: Download | undefined;

    const downloadPromise = page
      .waitForEvent('download')
      .then((d: Download) => {
        downloadEvent = d;
      })
      .catch(() => {});

    const response = await page.goto(url);
    await downloadPromise;

    if (downloadEvent) {
      const suggestedFilename = downloadEvent.suggestedFilename();
      const ext = path.extname(suggestedFilename) || '.jpg';

      const stream = await downloadEvent.createReadStream();
      if (!stream) {
        throw new Error('Download stream is null');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }

      return {
        buffer: Buffer.concat(chunks),
        ext: ext,
      };
    }

    if (!response) {
      throw new Error('No response received');
    }

    const buffer = await response.body();
    const contentType = response.headers()['content-type'] || '';
    let ext = '';

    if (contentType.includes('image/jpeg')) ext = '.jpg';
    else if (contentType.includes('image/png')) ext = '.png';
    else if (contentType.includes('image/webp')) ext = '.webp';
    else if (contentType.includes('image/avif')) ext = '.avif';
    else if (contentType.includes('application/pdf')) ext = '.pdf';

    return { buffer, ext };
  }
}
