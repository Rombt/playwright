import { BrowserContext, Page } from 'playwright';
import { IPagePool } from './IPagePool';
import { IResource } from '../../browser/IResource';
import { ILogger } from '../../data/logger/types/ILogger';
import { Logger } from '../../data/logger/Logger';
import { AppConfig } from '../../data/config/appConfig';

export class PagePool implements IPagePool, IResource {
  private readonly config: AppConfig;
  private free: Page[] = [];
  private created = 0;
  private waiters: ((p: Page) => void)[] = [];

  constructor(
    private readonly context: BrowserContext,
    private readonly quantityPage: number,
    private readonly loggerScope?: ILogger,
  ) {
    this.config = AppConfig.getInstance();
  }

  async acquire(): Promise<Page> {
    if (this.free.length) {
      return this.free.pop()!;
    }

    if (this.created < this.quantityPage) {
      try {
        const page = await this.context.newPage();
        this.created++;

        this.loggerScope?.debug(``, {
          component: 'PagePool',
          method: 'acquire',
          action: 'context.newPage',
          stage: 'start',
          data: {
            created: this.created,
            page: page,
          },
        });

        return page;
      } catch (error) {
        this.loggerScope?.error('Failed to create new page in pool', {
          component: 'PagePool',
          method: 'acquire',
          action: 'context.newPage',
          stage: 'start',
          data: {
            created: this.created,
            quantityLimit: this.quantityPage,
            freePages: this.free.length,
            waiters: this.waiters.length,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        throw error;
      }
    }

    // если количество страниц в пуле больше или равно разрешоному, свободных страниц нет а просят ещё
    return new Promise<Page>((resolve, reject) => {
      // ждать освобождения страницы не более this.config.asyncRetry.maxWaitForFreePage
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== wrappedResolve);

        const error = new Error(
          `PagePool acquire timeout: no free page became available within ${this.config.asyncRetry.maxWaitForFreePage}`,
        );

        Object.assign(error, {
          component: 'PagePool',
          method: 'acquire',
          action: 'context.newPage',
          stage: 'process',
          data: {
            created: this.created,
            quantityLimit: this.quantityPage,
            freePages: this.free.length,
            waiters: this.waiters.length,
          },
        });

        reject(error);
      }, this.config.asyncRetry.maxWaitForFreePage);

      const wrappedResolve = (page: Page) => {
        clearTimeout(timeout);
        resolve(page);
      };

      if (this.waiters.length >= this.config.asyncPages.maxWaiters) {
        this.loggerScope?.error('Waiters limit exceeded', {
          component: 'PagePool',
          method: 'acquire',
          action: 'enqueue_waiter',
          stage: 'waiters_limit',
          data: {
            currentWaiters: this.waiters.length,
            maxWaiters: this.config.asyncPages.maxWaiters,
          },
        });

        const error = new Error(`Pool waiters limit exceeded`);

        Object.assign(error, {
          component: 'PagePool',
          method: 'acquire',
          action: 'context.newPage',
          stage: 'process',
          data: {
            created: this.created,
            quantityLimit: this.quantityPage,
            freePages: this.free.length,
            waiters: this.waiters.length,
          },
        });

        reject(error);
      }

      this.waiters.push(wrappedResolve);
    });
  }

  release(page: Page) {
    if (!page) return;

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
        // Если использован wrappedResolve
        waiter(Promise.reject(new Error('PagePool is closing')) as unknown as Page);
      } catch (err) {
        this.loggerScope?.warn('Failed to reject waiter on close', {
          component: 'PagePool',
          method: 'close',
          action: 'reject_waiter',
          stage: 'cleanup',
          error: err,
        });
      }
    }
    this.waiters = [];

    // Закрываем все свободные страницы
    for (const page of this.free) {
      try {
        await page.close();
      } catch (err) {
        this.loggerScope?.warn('Error closing page during pool close', {
          component: 'PagePool',
          method: 'close',
          action: 'page.close',
          stage: 'cleanup',
          error: err,
        });
      }
    }

    // Сброс состояния пула
    this.free = [];
    this.created = 0;
  }
}
