import { Page } from 'playwright';
import { IActions } from '../types/IActions';

export class Actions implements IActions {
  constructor(private page: Page) {}

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).click();
  }

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    await this.page.locator(selector).waitFor({
      timeout,
    });
  }

  async scroll(options?: { step?: number; delay?: number }): Promise<void> {
    const step = options?.step ?? 1000;
    const delay = options?.delay ?? 200;

    let previousHeight = 0;

    while (true) {
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) break;

      previousHeight = currentHeight;

      await this.page.mouse.wheel(0, step);
      await this.page.waitForTimeout(delay);
    }
  }

  async waitForImages(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async getHtml(selector?: string): Promise<string> {
    if (!selector) {
      return await this.page.content();
    }

    const el = this.page.locator(selector).first();
    return await el.evaluate((node) => node.outerHTML);
  }

  async getAttribute(selector: string, attr: string): Promise<string | null> {
    return await this.page.locator(selector).first().getAttribute(attr);
  }

  async getText(selector: string): Promise<string | null> {
    return await this.page.locator(selector).first().textContent();
  }

  async exists(selector: string): Promise<boolean> {
    return (await this.page.locator(selector).count()) > 0;
  }
}
