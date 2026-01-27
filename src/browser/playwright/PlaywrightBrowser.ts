import { IBrowser as IBrowser } from "../IBrowser";
import {
  chromium,
  Browser as PWBrowser,
  BrowserContext,
  LaunchOptions,
  BrowserContextOptions
} from 'playwright';


export class PlaywrightBrowser implements IBrowser<PWBrowser, BrowserContext, LaunchOptions, BrowserContextOptions> {

  private instance: PWBrowser | null = null;


  constructor(
    private readonly launchOptions: LaunchOptions,
    private readonly browserContextOptions: BrowserContextOptions,
  ) {  }


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







  async runInContext<Result>(
    fn: (context: BrowserContext) => Promise<Result>
  ): Promise<Result> {

    const context = await this.createContext();

    try {
      return await fn(context);
    } finally {
      await context.close();
      this.close();
    }
  }
}
