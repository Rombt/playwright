import * as path from 'path';
import { AppConfig } from '../../../data/config/appConfig';

/**
 * Возвращает путь к файлу необработанных продуктов для конкретного бренда.
 * @param brand — название бренда
 * @returns string — путь к JSON файлу с необработанными продуктами
 */
export function getUnprocessedFilePath(brand: string): string {
  const cfg = AppConfig.getInstance();

  console.log('cfg.resultsFolder = ', cfg.resultsFolder);

  return path.join(cfg.resultsFolder, brand, `${brand}_unprocessed-products.json`);
}
