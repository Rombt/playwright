import { Page, Locator } from 'playwright-core';
import { resolveAttributeUrl } from './resolveAttributeUrl';

export async function getAbsoluteHref(page: Page, element: Locator): Promise<string> {
  return resolveAttributeUrl(element, 'href', page.url());
}
