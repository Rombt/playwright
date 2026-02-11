// src/common/helpers/data/writeProducts.ts

import * as fs from 'fs';
import { IProduct } from '../../../data/entities/IProduct';

export function writeProducts(filePath: string, products: IProduct[]): void {
  try {
    const content = JSON.stringify(products, null, 2); // форматированный JSON
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    console.error(`Error writing products to ${filePath}:`, err);
  }
}
