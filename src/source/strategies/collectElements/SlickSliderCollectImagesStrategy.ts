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

export default class SlickSliderCollectImagesStrategy
  implements IStrategy<CollectImagesParams, CollectImagesResult>
{
  name = 'SlickSliderCollectImagesStrategy';

  // сейчас не использую может в будущих версиях
  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    // базовая стратегия — всегда может работать
    return true;
  }

  // сейчас не использую может в будущих версиях
  async score(): Promise<number> {
    return 10;
  }

  // async execute(ctx: IExecutionContext): Promise<CollectImagesResult> {
  //   const { page } = ctx;

  //   //!! ctx.state.locatorGallery должен содержать селектор именно родителя всей галереи!!
  //   const gallery = ctx.state.locatorGallery as Locator;

  //   await gallery.locator('.slick-track').waitFor({
  //     state: 'visible',
  //     timeout: ctx.appConfig.asyncRetry.maxDelay,
  //   });

  //   await gallery.evaluate((node) => {
  //     const hasSlick = node.querySelector('.slick-track');

  //     if (!hasSlick) {
  //       throw new Error('Slick slider is not initialized');
  //     }
  //   });

  //   // Иногда slick лениво подставляет src
  //   await page.waitForTimeout(300);

  //   const imageUrls = await gallery.evaluate((root) => {
  //     const imgs = Array.from(root.querySelectorAll('img'));

  //     const urls = imgs
  //       .map((img) => {
  //         return (
  //           img.getAttribute('src') ||
  //           img.getAttribute('data-src') ||
  //           img.getAttribute('data-lazy') ||
  //           img.getAttribute('data-original')
  //         );
  //       })
  //       .filter((src): src is string => {
  //         if (!src) return false;

  //         const value = src.trim();

  //         if (!value) return false;

  //         // мусор
  //         if (value.startsWith('data:image')) return false;
  //         if (value.startsWith('blob:')) return false;

  //         return true;
  //       });

  //     // dedupe
  //     return [...new Set(urls)];
  //   });

  //   const absoluteImageUrls = imageUrls.map((src) => new URL(src, page.url()).toString());

  //   if (absoluteImageUrls.length === 0) {
  //     throw new Error('No valid image URLs found');
  //   }

  //   ctx.logger?.debug('URL of images are received', {
  //     component: 'CollectImgStep',
  //     method: 'execute()',
  //     action: '',
  //     data: {
  //       absoluteImageUrls,
  //     },
  //   });

  //   ctx.state.images ??= [];

  //   return {
  //     absoluteImageUrls,
  //   };
  // }

  async execute(ctx: IExecutionContext): Promise<CollectImagesResult> {
    const { page } = ctx;

    // !! ctx.state.locatorGallery должен содержать селектор именно родителя всей галереи !!
    const gallery = ctx.state.locatorGallery as Locator;

    await gallery.locator('.slick-track').waitFor({
      state: 'visible',
      timeout: ctx.appConfig.asyncRetry.maxDelay,
    });


    await gallery.evaluate((node) => {
      const hasSlick = node.querySelector('.slick-track');

      if (!hasSlick) {
        throw new Error('Slick slider is not initialized');
      }
    });

    // Иногда slick лениво подставляет src
    await page.waitForTimeout(ctx.appConfig.asyncRetry.maxDelay);

    const imageUrls = await gallery.evaluate((root) => {
      const imgs = Array.from(root.querySelectorAll('img'));

      const urls = imgs
        .map((img) => {
          const candidates = [
            img.getAttribute('data-src'),
            img.getAttribute('data-lazy'),
            img.getAttribute('data-original'),
            img.getAttribute('data-zoom-image'),
            img.getAttribute('data-large-image'),
            img.getAttribute('src'),
          ];

          return candidates.find((value) => {
            if (!value) {
              return false;
            }

            const src = value.trim();

            return src !== '' && !src.startsWith('data:image') && !src.startsWith('blob:');
          });
        })
        .filter((src): src is string => Boolean(src));

      return [...new Set(urls)];
    });

    const absoluteImageUrls = imageUrls.map((src) => new URL(src, page.url()).toString());

    if (absoluteImageUrls.length === 0) {
      throw new Error('No valid image URLs found');
    }

    ctx.logger?.debug('URL of images are received', {
      component: 'CollectImgStep',
      method: 'execute()',
      action: '',
      data: {
        absoluteImageUrls,
      },
    });

    ctx.state.images ??= [];

    return {
      absoluteImageUrls,
    };
  }
}
