import { Locator } from 'playwright-core';
import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { getAbsoluteHref } from '../../../common/helpers';

type CollectImgParams = {
  stopProcessing: boolean;
};

export default class CollectImgStep extends BaseStep {
  public readonly name = 'CollectImgStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: CollectImgStepParams,
  ): Promise<void> {
    const { page } = ctx;

    const stepConfig = ctx.stepParams?.get(CollectImgStep) as unknown as CollectImgParams;

    // todo
    // const strategy = ctx.strategyResolver.get<CheckSearchResultsParams, SearchResult>(
    //   stepConfig.strategy,
    // );

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
    ctx.state.images?.push(...absoluteImageUrls);

    // если источник не содержит описания товаров
    if (stepConfig.stopProcessing === true) {
      ctx.control.stop = true;
    }
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create(''),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
