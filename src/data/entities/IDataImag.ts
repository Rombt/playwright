export interface IDataImagItem extends Array<string> {
  idProduct: number;
}

export interface IDataImag {
  [sku: string]: IDataImagItem;
}
