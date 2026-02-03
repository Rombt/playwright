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

import * as path from 'path';

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

      await this.instance.close();
    } catch (err) {
      console.warn('Error closing browser:', err);
    } finally {
      this.instance = null;
    }

    console.log('Browser closed.');
  }

  async createContext(): Promise<BrowserContext> {
    const browser = await this.init();

    return await browser.newContext(this.browserContextOptions);
  }

  async runInContext<Result>(fn: (context: BrowserContext) => Promise<Result>): Promise<Result> {
    const context = await this.createContext();

    try {
      return await fn(context);
    } finally {
      await context.close();
    }
  }

  async download(page: Page, url: string): Promise<{ filename: string; buffer: Buffer }> {
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
      const filename = downloadEvent.suggestedFilename();

      const stream = await downloadEvent.createReadStream();
      if (!stream) {
        throw new Error('Download stream is null');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }

      return {
        filename,
        buffer: Buffer.concat(chunks),
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

    const baseName = path.basename(new URL(url).pathname) || 'file';

    const filename = baseName + ext;

    return { filename, buffer };
  }
}
