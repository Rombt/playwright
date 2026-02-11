import { IProduct } from '../../data/entities/IProduct';

/**
 * Data Layer collector for unprocessed products.
 *
 * Rules:
 * - Brand names are case-insensitive (normalized to lowercase).
 * - Brand names are derived from filenames:
 *   {brand}_unprocessed-products.json
 * - Unknown brands are allowed and return empty results.
 * - Collector returns ONLY product entities (IProduct).
 */
export interface IUnprocessedCollector {
  /**
   * Returns unprocessed products.
   *
   * @param brand - Brand name or list of brands (case-insensitive).
   *                If omitted, products for all brands are returned.
   */
  getProducts(brand?: string | string[]): IProduct[];

  /**
   * Returns list of available brands
   * derived from unprocessed product filenames.
   *
   * Brand names are returned in normalized (lowercase) form.
   */
  getBrands(): string[];

  /**
   * Returns total count of unprocessed products across all brands.
   */
  countTotal(): number;

  /**
   * Returns unprocessed product count grouped by brand.
   *
   * Example:
   * { nike: 12, adidas: 4 }
   */
  countByBrand(): Record<string, number>;

  /**
   * Returns unprocessed product count for specified brand(s).
   *
   * @param brand - Brand name or list of brands (case-insensitive).
   */
  count(brand: string | string[]): number;

  /**
   * Returns a summary of unprocessed products by brand.
   * Alias of countByBrand(), provided for semantic clarity.
   */
  getSummary(): Record<string, number>;

  /**
   * Logs a short summary of unprocessed products by brand.
   * Intended for monitoring and debug output.
   */
  logSummary(): void;
}
