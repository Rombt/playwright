import { Page } from 'playwright-core';
import { IAutocompleteResult, IAutocompleteClient } from './IAutocompleteClient';

export class AutocompleteClient implements IAutocompleteClient {
  constructor(
    private readonly page: Page,
    private readonly searchInputSelector: string,
    private readonly apiUrlPart: string = '/autocomplete/',
    private readonly typeDelayMs: number = 120,
  ) {}

  async searchBySku(sku: string): Promise<IAutocompleteResult> {
    const input = this.page.locator(this.searchInputSelector);

    await input.click();
    await input.fill('');

    const start = Date.now();

    const [response] = await Promise.all([
      this.page.waitForResponse(
        resp => resp.url().includes(this.apiUrlPart) && resp.request().method() === 'GET',
      ),
      input.type(sku, { delay: this.typeDelayMs }),
    ]);

    const durationMs = Date.now() - start;

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // намеренно игнорируем — BanDetector решит
    }

    return {
      sku,
      response,
      data,
      durationMs,
    };
  }
}
