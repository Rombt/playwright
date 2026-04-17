import { Page } from 'playwright';
import { IImageExtractor } from '../extractors/types/IImageExtractor';

export class SwatchGalleryExtractor implements IImageExtractor {
  constructor(
    private swatchSelector: string = '[data-swatch]',
    private imageSelector: string = 'img',
  ) {}

  async extract(page: Page): Promise<string[]> {
    const result = new Set<string>();

    // 1. Находим все свотчи
    const swatches = await page.$$(this.swatchSelector);

    // Если свотчей нет — просто берём текущие изображения
    if (!swatches.length) {
      return await this.collectImages(page, result);
    }

    // 2. Проходим по каждому свотчу
    for (let i = 0; i < swatches.length; i++) {
      const swatch = swatches[i];

      try {
        // 2.1 Клик
        await swatch.click({ timeout: 3000 });

        // 2.2 Ждём обновление DOM
        await page.waitForTimeout(300);

        // 2.3 Иногда нужно дождаться загрузки картинок
        await page.waitForLoadState('load').catch(() => {});

        // 2.4 Собираем изображения
        await this.collectImages(page, result);
      } catch (e) {
        // не валим пайплайн
        continue;
      }
    }

    return Array.from(result);
  }

  // =========================================

  private async collectImages(page: Page, result: Set<string>): Promise<string[]> {
    const images = await page.$$(this.imageSelector);

    for (const img of images) {
      const src = (await img.getAttribute('src')) || (await img.getAttribute('data-src'));

      if (src && !this.isBase64(src)) {
        result.add(src);
      }
    }

    return Array.from(result);
  }

  private isBase64(src: string): boolean {
    return src.startsWith('data:image');
  }
}
