import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { getAbsoluteHref } from '../../../common/helpers';

// type SearchGalleryParams = {
//   sku: string;
// };

export default class SearchGalleryStep extends BaseStep {
  public readonly name = 'SearchGalleryStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: SearchGalleryParams,
  ): Promise<void> {
    const { page } = ctx;

    const stepConfig = ctx.stepParams?.get(SearchGalleryStep) as {
      gallerySelector: string;
    };
    const gallerySelector = stepConfig?.gallerySelector;

    const gallery = page.locator(gallerySelector);

    try {
      await gallery.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
    } catch (error) {
      throw new Error('No gallery found on page');
    }

    const count = await gallery.count();
    if (count === 0) throw new Error('No images found on page');

    const firstImg = gallery.locator('img').first();
    await firstImg.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });

    ctx.logger?.debug('The gallery is found', {
      component: 'SearchGalleryStep',
      data: {
        ctx: ctx,
        galleryCount: count,
        gallery: gallery,
      },
    });

    ctx.state.locatorGallery = gallery;
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('CollectImgStep'), //!!!!
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
