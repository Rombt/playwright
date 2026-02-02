import { IBrowser as IBrowser } from '../IBrowser';
import {
  chromium,
  Browser as PWBrowser,
  BrowserContext,
  LaunchOptions,
  BrowserContextOptions,
} from 'playwright';

import { IDownloadedFile } from '../IDownloadedFile';
import * as path from 'path';
import * as os from 'os';

export class PlaywrightBrowser
  implements
    IBrowser<PWBrowser, BrowserContext, IDownloadedFile, LaunchOptions, BrowserContextOptions>
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
    if (!this.isInitialized) return; // т.к. браузер должен быть один
    await this.instance?.close();
    this.instance = null;
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
      this.close();
    }
  }

  async download(context: BrowserContext, url: string): Promise<IDownloadedFile> {
    const page = await context.newPage();

    try {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(url => {
          const a = document.createElement('a');
          a.href = url;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, url),
      ]);

      const filename = await download.suggestedFilename();
      const tempPath = path.join(os.tmpdir(), filename);

      await download.saveAs(tempPath);

      return {
        path: tempPath,
        filename,
      };
    } finally {
      await page.close();
    }
  }
}
