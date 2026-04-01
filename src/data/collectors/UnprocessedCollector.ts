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
        const product = this.extractProduct(item);
        if (product) products.push(product);
      }
    }

    return products;
  }

  getBrands(): string[] {
    return this.getAllBrandNames();
  }

  //todo добавить target URL для каждого продукта
  public getPhotoCollectionTasks(mode: string): ICollectProductPhotosTask[] {
    const brandedProducts = this.getBrandedProductsForTasks();

    const grouped = new Map<string, { product: IProduct; target_website: string | null }[]>();

    for (const { brand, product, target_website } of brandedProducts) {
      if (!grouped.has(brand)) grouped.set(brand, []);
      grouped.get(brand)!.push({ product, target_website });
    }

    const tasks: ICollectProductPhotosTask[] = [];

    for (const [brand_name, items] of grouped.entries()) {
      const firstUrl = items[0]?.target_website ?? null;

      const task: any = {
        brand_id: null,
        brand_name,
        metadata: {
          target_website: firstUrl,
        },
        products: items.map((i) => i.product),
      };

      if (mode === 'retry') {
        task.type = 'recollect-product-photos';
      }

      tasks.push(task);
    }

    return tasks;
  }

  // private getProductsWithBrand(): IBrandedProduct[] {
  //   const files = this.getBrandFiles(null);
  //   const result: IBrandedProduct[] = [];

  //   for (const file of files) {
  //     const brand = this.extractBrandFromFilename(file);
  //     if (!brand) continue;

  //     const items = this.readFile(file);

  //     for (const item of items) {
  //       const product = this.extractProduct(item);
  //       if (product) {
  //         result.push({
  //           brand,
  //           product,
  //         });
  //       }
  //     }
  //   }

  //   return result;
  // }

  private getBrandedProductsForTasks(): {
    brand: string;
    product: IProduct;
    target_website: string | null;
  }[] {
    const files = this.getBrandFiles(null);
    const result: { brand: string; product: IProduct; target_website: string | null }[] = [];

    for (const file of files) {
      const brand = this.extractBrandFromFilename(file);
      if (!brand) continue;

      const items = this.readFile(file);

      for (const item of items) {
        const product = this.extractProduct(item);
        if (product) {
          const target_website = this.extractTargetUrl(item);
          result.push({ brand, product, target_website });
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

  private extractTargetUrl(item: any): string | null {
    return item?.targetUrl ?? null;
  }

  private extractProduct(item: any): IProduct | null {
    // сначала проверяем item.error.product, потом item.error.meta.product
    return item?.error?.product ?? item?.error?.meta?.product ?? null;
  }

  /**
   * Normalize brand input to lowercase array.
   * undefined → null (means all brands)
   */
  private normalizeBrands(brand?: string | string[]): string[] | null {
    if (!brand) return null;

    const brands = Array.isArray(brand) ? brand : [brand];

    const normalized = brands.map((b) => b.trim().toLowerCase()).filter(Boolean);

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

    return allFiles.filter((file) => {
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
      .map((file) => this.extractBrandFromFilename(file))
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
