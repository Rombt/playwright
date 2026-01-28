import { BrowserContext, Page } from 'playwright';

export class PagePool {
  private readonly pages: Page[] = [];

  constructor(
    private readonly context: BrowserContext,
    private readonly size: number
  ) {}

  async init(): Promise<Page[]> {
    for (let i = 0; i < this.size; i++) {
      this.pages.push(await this.context.newPage());
    }
    return this.pages;
  }

  async destroy(): Promise<void> {
    await Promise.all(this.pages.map(p => p.close()));
  }
}