import { Response } from 'playwright-core';

export interface IAutocompleteResult {
  sku: string;
  response: Response;
  data: any;
  durationMs: number;
}

export interface IAutocompleteClient {
  searchBySku(sku: string): Promise<IAutocompleteResult>;
}
