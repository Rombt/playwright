import { Page } from 'playwright';

export interface IExtractor<T> {
  extract(page: Page, debugMeta?: Record<string, string>): Promise<T>;
}
