import { IBrowser as IBrowser } from "../IBrowser";
// import { chromium, Browser as PWBrowser, Page } from "playwright";
import { chromium, Browser as PWBrowser, BrowserContext as Context} from 'playwright';


export class PlaywrightBrowser implements IBrowser<PWBrowser, Context> {


  private instance: PWBrowser | null = null;

  public get isInitialized(): boolean {
    return this.instance !== null;
  }

  async init(): Promise<PWBrowser> {
    if (this.isInitialized) return this.instance!;

    this.instance = await chromium.launch();
    return this.instance;
  }

  async close(): Promise<void> {
    if (!this.isInitialized) return; // Защита от лишних вызовов

    await this.instance?.close();
    this.instance = null;
  }

  async runInContext<Result>(fn: (context:Context) => Promise<Result>): Promise<Result> {


    const browser = await this.init();
    const context = await browser.newContext();

    try {
      return await fn(context);
    } finally {
      await context.close();
    }


  }



}
