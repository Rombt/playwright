import { Page } from 'playwright';
import { IDescriptionExtractor } from './types/IDescriptionExtractor';

export class SimpleDescriptionExtractor implements IDescriptionExtractor {
  constructor(private selector: string) {}

  async extract(page: Page, debugMeta?: Record<string, string>): Promise<string | null> {
    try {
      // 1. Ждём элемент (но не бесконечно)
      const element = await page.waitForSelector(this.selector, {
        timeout: 5000,
      });

      if (!element) {
        return null;
      }

      // 2. Берём HTML (не textContent!)
      const html = await element.innerHTML();

      // 3. Чистим (минимально)
      const cleaned = html?.trim();

      return cleaned || null;
    } catch (e) {
      // не валим pipeline
      return null;
    }
  }
}
