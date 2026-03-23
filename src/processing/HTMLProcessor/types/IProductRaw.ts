import { IProductRawContent } from './IProductRawContent';

export interface IProductRaw {
  sku: string | number;
  id: string | number;
  content: IProductRawContent;
}
