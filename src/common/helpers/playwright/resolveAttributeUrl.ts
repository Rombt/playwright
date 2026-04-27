import { Locator } from 'playwright-core';

export async function resolveAttributeUrl(
  element: Locator,
  attribute: string,
  baseUrl: string,
): Promise<string> {
  const value = await element.getAttribute(attribute);

  if (!value) {
    throw new Error(`Attribute "${attribute}" not found for element (baseUrl: ${baseUrl})`);
  }

  return new URL(value, baseUrl).toString();
}
