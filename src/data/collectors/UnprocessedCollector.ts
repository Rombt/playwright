import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from '../../data/config/appConfig';

import { IProduct } from '../../data/entities/IProduct';
import { IUnprocessedCollector } from './IUnprocessedCollector';
import { ICollectProductPhotosTask } from '../entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';

type IBrandedProduct = {
  brand: string;
  product: IProduct;
};

export class UnprocessedCollector implements IUnprocessedCollector {
  private readonly config: AppConfig;
  private readonly resultsFolder: string;

  constructor() {
    this.config = AppConfig.getInstance();
    this.resultsFolder = this.config.resultsFolder;
  }

  getProducts(brand?: string | string[]): IProduct[] {
    const brands = this.normalizeBrands(brand);

    const files = this.getBrandFiles(brands);

    const products: IProduct[] = [];

    for (const file of files) {
      const items = this.readFile(file);
      for (const item of items) {
        if (item?.error?.product) {
          products.push(item.error.product);
        }
      }
    }

    return products;
  }

  getBrands(): string[] {
    return this.getAllBrandNames();
  }

  public getPhotoCollectionTasks(): ICollectProductPhotosTask[] {
    const brandedProducts = this.getProductsWithBrand();

    const grouped = new Map<string, IProduct[]>();

    for (const { brand, product } of brandedProducts) {
      if (!grouped.has(brand)) {
        grouped.set(brand, []);
      }

      grouped.get(brand)!.push(product);
    }

    const tasks: ICollectProductPhotosTask[] = [];

    for (const [brand_name, products] of grouped.entries()) {
      tasks.push({
        type: 'recollect-product-photos',
        brand_id: null,
        brand_name,
        metadata: {
          target_website: null,
        },
        products,
      });
    }

    return tasks;
  }

  private getProductsWithBrand(): IBrandedProduct[] {
    const files = this.getBrandFiles(null);
    const result: IBrandedProduct[] = [];

    for (const file of files) {
      const brand = this.extractBrandFromFilename(file);
      if (!brand) continue;

      const items = this.readFile(file);

      for (const item of items) {
        if (item?.error?.product) {
          result.push({
            brand,
            product: item.error.product,
          });
        }
      }
    }

    return result;
  }

  countTotal(): number {
    return this.getProducts().length;
  }

  countByBrand(): Record<string, number> {
    const result: Record<string, number> = {};

    for (const brand of this.getAllBrandNames()) {
      result[brand] = this.count(brand);
    }

    return result;
  }

  count(brand: string | string[]): number {
    return this.getProducts(brand).length;
  }

  getSummary(): Record<string, number> {
    return this.countByBrand();
  }

  logSummary(): void {
    const summary = this.getSummary();

    for (const [brand, count] of Object.entries(summary)) {
      console.log(`${brand}: ${count}`);
    }
  }

  // ============  helpers  ====================================

  /**
   * Normalize brand input to lowercase array.
   * undefined → null (means all brands)
   */
  private normalizeBrands(brand?: string | string[]): string[] | null {
    if (!brand) return null;

    const brands = Array.isArray(brand) ? brand : [brand];

    const normalized = brands.map(b => b.trim().toLowerCase()).filter(Boolean);

    return normalized.length ? normalized : null;
  }

  /**
   * Returns absolute paths to brand files.
   */
  private getBrandFiles(brands: string[] | null): string[] {
    const allFiles = this.getAllBrandFiles();

    if (!brands) {
      return allFiles;
    }

    return allFiles.filter(file => {
      const brand = this.extractBrandFromFilename(file);
      return brand !== null && brands.includes(brand);
    });
  }

  /**
   * Returns all valid brand filenames.
   */
  private getAllBrandFiles(): string[] {
    if (!fs.existsSync(this.resultsFolder)) {
      return [];
    }

    const result: string[] = [];

    const walk = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        }

        if (entry.isFile() && entry.name.endsWith('_unprocessed-products.json')) {
          result.push(fullPath);
        }
      }
    };

    walk(this.resultsFolder);

    return result;
  }

  /**
   * Extract brand name from filename.
   */
  private extractBrandFromFilename(filePath: string): string | null {
    const filename = path.basename(filePath);
    const match = filename.match(/^(.+?)_unprocessed-products\.json$/);

    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Returns all available brand names.
   */
  private getAllBrandNames(): string[] {
    return this.getAllBrandFiles()
      .map(file => this.extractBrandFromFilename(file))
      .filter((b): b is string => Boolean(b));
  }

  /**
   * Read and parse JSON file.
   * Returns empty array on any error.
   */
  private readFile(filePath: string): any[] {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}
