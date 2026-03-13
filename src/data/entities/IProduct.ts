export interface IProduct {
  id_product: number;
  name_product: string;
  sku: string;
  attributes: {
    color: string;
    size: string;
  };
}
