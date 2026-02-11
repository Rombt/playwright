// src/common/helpers/data/readProducts.ts

import * as fs from 'fs';
import { IProduct } from '../../../data/entities/IProduct';

export function readProducts(filePath: string): IProduct[] {
  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const products: IProduct[] = JSON.parse(content);
    return Array.isArray(products) ? products : [];
  } catch (err) {
    console.error(`Error reading products from ${filePath}:`, err);
    return [];
  }
}
