import { BrowserContext, Page } from 'playwright';
import { IPagePool } from './IPagePool';

export class PagePool implements IPagePool {
  private free: Page[] = [];
  private created = 0;
  private waiters: ((p: Page) => void)[] = [];

  constructor(private readonly context: BrowserContext, private readonly quantityPage: number) {}

  async acquire(): Promise<Page> {
    if (this.free.length) {
      return this.free.pop()!;
    }

    if (this.created < this.quantityPage) {
      const page = await this.context.newPage();
      this.created++;
      return page;
    }

    return new Promise<Page>(resolve => {
      this.waiters.push(resolve);
    });
  }

  release(page: Page) {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(page);
    } else {
      this.free.push(page);
    }
  }
}
