import { BrowserContext, Page } from 'playwright';  //todo должен быть какой то общий интерфейс


export interface IPagePool {
  acquire(): Promise<Page>;
  release(page: Page): void;
}