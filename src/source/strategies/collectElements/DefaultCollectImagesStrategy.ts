import { Page, Locator } from 'playwright-core';
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
export default class DefaultCollectImagesStrategy
  implements IStrategy<CollectImagesParams, CollectImagesResult>
{
  name = 'DefaultCollectImagesStrategy';

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

    const gallery = ctx.state.locatorGallery as Locator;

    const imageUrls = await gallery
      .locator('img')
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')).filter(Boolean));

    const absoluteImageUrls = imageUrls.map((src) => new URL(src!, page.url()).toString());

    if (absoluteImageUrls.length === 0) throw new Error('No valid image URLs found');

    ctx.logger?.debug('URL of images are received', {
      component: 'CollectImgStep',
      method: 'execute()',
      action: '',
      data: {
        absoluteImageUrls: absoluteImageUrls,
      },
    });

    if (!ctx.state.images) {
      ctx.state.images = [];
    }

    return {
      absoluteImageUrls,
    };
  }
}
