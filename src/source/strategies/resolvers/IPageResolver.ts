import { Page } from 'playwright';

export interface IPageResolver {
  resolve(page: Page, targetUrl: string, debugMeta?: Record<string, string>): Promise<void>;
}
