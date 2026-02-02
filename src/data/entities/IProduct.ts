export interface IProduct {
  id_product: string;
  name_product: string;
  sku: string;
  attributes: {
    color: string;
    size: string;
  };
}
