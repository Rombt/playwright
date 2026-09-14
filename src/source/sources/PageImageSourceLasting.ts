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
import CollectDescriptionStep from '../steps/collectElements/CollectDescriptionStep';
import OpenSearchPageStep from '../steps/openPages/OpenSearchPageStep';

import { IExtractHtmlOptions, normalizeSku } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    // return new PageImageSourceLasting(deps.flowRunner deps.logger);
    return new PageImageSourceLasting(deps.flowRunner);
  },
};

class PageImageSourceLasting implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://shambala.com.ua/lasting/#/search/{{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    if (!ctx.input.sku) {
      throw new Error('SKU is required');
    }

    const clearSku = normalizeSku(ctx.input.sku);

    ctx.stepParams = new Map([
      [
        OpenSearchPageStep,
        {
          strategy: 'WaitForElementOpenSearchPageStrategy',
          waitForSelector: `div.multi-cell div.multi-item div.multi-content a > span:has-text("${clearSku}")`,
        },
      ],
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: `a:has-text("${clearSku}")`,
          emptySelector: '.multi-noResults:has-text("Нічого не знайдено")',
        },
      ],
      [CheckPageSkuStep, { pageSkuSelector: `h1:has-text(${clearSku}` }],
      [
        SearchGalleryStep,
        {
          gallerySelector: 'div.product__section--gallery > section.gallery',
        },
      ],
      [
        CollectImgStep,
        {
          // strategy: 'SlickSliderCollectImagesStrategy',
          strategy: 'DefaultCollectImagesStrategy',
          stopProcessing: true,
        },
      ],

      [
        CollectDescriptionStep,
        {
          containers: ['div.product-description'],
          removeSelectors: [],
          expand: false,
          separator: '\n',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceLasting is finished', {
      component: 'PageImageSourceLasting',
      method: 'execute()',
      action: 'await this.flowRunner.run(startStep, ctx)',
      data: {
        ctx: ctx,
      },
    });

    const product = ctx.input.product!;
    const sku = product.sku;

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
