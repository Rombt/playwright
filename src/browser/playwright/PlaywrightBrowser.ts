import { Browser as IBrowser } from "../Browser";
import { chromium, Browser as PWBrowser, Page } from "playwright";

export class PlaywrightBrowser implements IBrowser {
  private browser?: PWBrowser;
  private page?: Page;

  async open(url: string): Promise<void> {
    if (!this.browser) this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
  }

  async getHtml(): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");
    return await this.page.content();
  }

  async find(selector: string): Promise<boolean> {
    if (!this.page) throw new Error("Page not initialized");
    const el = await this.page.$(selector);
    return el !== null;
  }

  async getAttribute(selector: string, name: string): Promise<string | null> {
    if (!this.page) throw new Error("Page not initialized");
    const el = await this.page.$(selector);
    if (!el) return null;
    return await el.getAttribute(name);
  }

  async download(url: string, saveAs: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");
    const [ download ] = await Promise.all([
      this.page.waitForEvent("download"),
      this.page.evaluate((u) => window.open(u), url)
    ]);
    await download.saveAs(saveAs);
  }

  async close(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
    this.page = undefined;
    this.browser = undefined;
  }
}
