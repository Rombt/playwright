import { BrowserContext, Page } from 'playwright';
import { IPagePool } from './IPagePool';
import { IResource } from '../../browser/IResource';

export class PagePool implements IPagePool, IResource {
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

  async close(): Promise<void> {
    // Прекращаем ожидание всех waiters
    for (const waiter of this.waiters) {
      try {
        waiter(Promise.reject(new Error('PagePool is closing')) as unknown as Page);
      } catch {}
    }
    this.waiters = [];

    // Закрываем все свободные страницы
    for (const page of this.free) {
      try {
        await page.close();
      } catch (err) {
        console.warn('Error closing page:', err);
      }
    }

    this.free = [];
    this.created = 0;
  }
}
