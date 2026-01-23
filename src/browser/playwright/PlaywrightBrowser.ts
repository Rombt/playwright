import { IBrowser as IBrowser } from "../IBrowser";
import {
  chromium,
  Browser as PWBrowser,
  BrowserContext as Context,
  LaunchOptions,
  BrowserContextOptions
} from 'playwright';


export class PlaywrightBrowser implements IBrowser<PWBrowser, Context, LaunchOptions, BrowserContextOptions> {

  private instance: PWBrowser | null = null;


  constructor(private readonly launchOptions: LaunchOptions) {


  }


  public get isInitialized(): boolean {
    return this.instance !== null;
  }

  async init(): Promise<PWBrowser> {
    if (this.isInitialized) return this.instance!;

    this.instance = await chromium.launch(this.launchOptions);
    return this.instance;
  }

  async close(): Promise<void> {
    if (!this.isInitialized) return; // Защита от лишних вызовов

    await this.instance?.close();
    this.instance = null;
  }

  async runInContext<Result>(
    fn: (context: Context) => Promise<Result>,
    options?: BrowserContextOptions
  ): Promise<Result> {


    const browser = await this.init();
    const context = await browser.newContext(options);

    try {
      return await fn(context);
    } finally {
      await context.close();
    }


  }



}
