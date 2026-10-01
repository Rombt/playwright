import { ISourceDependencies } from '../types/ISourceDependencies';
import { ISource } from '../types/ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IFlowRunner } from '../types/IFlowRunner';
import { ILogger } from '../../data/logger/types/ILogger';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IExecutionContext } from '../types/IExecutionContext';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';

import CheckSearchResultsStep from '../steps/checks/CheckSearchResultsStep';
import CheckPageSkuStep from '../steps/checks/CheckPageSkuStep';
import SearchGalleryStep from '../steps/searchElements/SearchGalleryStep';
import CollectImgStep from '../steps/collectElements/CollectImgStep';
// import CollectDescriptionStep from '../steps/collectElements/CollectDescriptionStep';

import { normalizeSku, IExtractHtmlOptions } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    // return new PageImageSourceUsPuma(deps.flowRunner deps.logger);
    return new PageImageSourceUsPuma(deps.flowRunner);
  },
};

class PageImageSourceUsPuma implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://us.puma.com/us/en/search?q={{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {


    ctx.logger?.debug('00 Processing of the PageImageSourceUsPuma', {
      component: 'PageImageSourceUsPuma',
      method: 'execute()',
      action: 'await this.flowRunner.run(startStep, ctx)',
      data: {
        ctx: ctx,
      },
    });    


    const product = ctx.input.product!;
    let sku = normalizeSku(product.sku);

    const baseUrl = ctx.task.metadata.target_website;
    if (!baseUrl) {
      throw new Error('target_website is not defined');
    }

    ctx.state.urlProductPage = baseUrl.replace('{{sku_prod}}', sku);
    ctx.input.normalizedSku = sku.slice(0, -2) + '_' + sku.slice(-2);

    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: `li[data-product-id="${ctx.input.normalizedSku}"] > div > a`,
          emptySelector: 'h1',
          emptySelectorText: "Sorry, we couldn't find what you are looking for.",
        },
      ],

      [CheckPageSkuStep, { pageSkuSelector: `li:has-text("Style: ${ctx.input.normalizedSku}")` }],
      [SearchGalleryStep, { gallerySelector: '#product-gallery' }],
      [
        CollectImgStep,
        {
          // strategy: 'SlickSliderCollectImagesStrategy',
          strategy: 'DefaultCollectImagesStrategy',
          stopProcessing: true,
        },
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceUsPuma is finished', {
      component: 'PageImageSourceUsPuma',
      method: 'execute()',
      action: 'await this.flowRunner.run(startStep, ctx)',
      data: {
        ctx: ctx,
      },
    });

    sku = product.sku;

    const images: IDataImag = {};

    if (ctx.state.images?.length) {
      images[sku] = ctx.state.images as IDataImagItem;
      images[sku].idProduct = product.id_product;
    }

    return {
      data: {
        images,
        html: ctx.state.html,
      },
      errors: ctx.errors,
    };
  }
}
