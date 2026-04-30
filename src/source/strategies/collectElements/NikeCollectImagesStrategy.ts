import { Page } from 'playwright-core';
import { IStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { AppConfig } from '../../../data/config/appConfig';
import { getAbsoluteHref } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';

type CollectImagesResult = {
  absoluteImageUrls: string[];
};

type CollectImagesParams = {};

// todo подобрать название по лучше!!
export default class NikeCollectImagesStrategy
  implements IStrategy<CollectImagesParams, CollectImagesResult>
{
  name = 'NikeCollectImagesStrategy';

  // сейчас не использую может в будущих версиях
  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    // базовая стратегия — всегда может работать
    return true;
  }

  // сейчас не использую может в будущих версиях
  async score(): Promise<number> {
    return 10;
  }

  async execute(
    ctx: IExecutionContext,
    // params: CheckSearchResultsParams,
  ): Promise<CollectImagesResult> {
    const { page } = ctx;

    const absoluteImageUrls = await this.collectNikeImages(page);

    return {
      absoluteImageUrls,
    };
  }

  async collectNikeImages(page: Page): Promise<string[]> {
    // 1. Собираем все возможные изображения
    const locators = page.locator(`
      [data-testid="HeroImg"],
      [data-testid^="Thumbnail-Img"]
    `);

    const count = await locators.count();

    const rawUrls: string[] = [];

    for (let i = 0; i < count; i++) {
      const src = await locators.nth(i).getAttribute('src');
      if (!src) continue;

      // 2. фильтр: убираем видео-превью
      if (src.includes('/videos/')) continue;

      rawUrls.push(src);
    }

    // 3. убираем дубликаты
    const unique = [...new Set(rawUrls)];

    // 4. нормализуем в максимум качества
    const result: string[] = [];

    for (const url of unique) {
      const best = await this.getBestQuality(url);
      if (best) result.push(best);
    }

    return result;
  }

  async getBestQuality(url: string): Promise<string | null> {
    const candidates = this.buildCandidates(url);

    for (const candidate of candidates) {
      if (await this.urlExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  buildCandidates(url: string): string[] {
    const candidates: string[] = [];

    // 1. оригинал (иногда работает)
    candidates.push(url.replace(/\/a\/images\/[^/]+\//, '/a/images/'));

    // 2. максимальные пресеты
    candidates.push(url.replace(/t_[^/]+/, 't_PDP_1440_v1'));
    candidates.push(url.replace(/t_[^/]+/, 't_PDP_1024_v1'));

    // 3. hero как fallback
    candidates.push(url);

    return [...new Set(candidates)];
  }

  async urlExists(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
