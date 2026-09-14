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
    // return new PageImageSourceLasting_1(deps.flowRunner deps.logger);
    return new PageImageSourceLasting_1(deps.flowRunner);
  },
};

class PageImageSourceLasting_1 implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website ===
      'https://shop.lasting.eu/en/index.php?fc=module&module=leoproductsearch&controller=productsearch&search_query={{sku_prod}}'
    );
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    if (!ctx.input.sku) {
      throw new Error('SKU is required');
    }

    const clearSku = normalizeSku(ctx.input.sku);

    ctx.stepParams = new Map([
      // [
      //   OpenSearchPageStep,
      //   {
      //     strategy: 'WaitForElementOpenSearchPageStrategy',
      //     waitForSelector: `div.multi-cell div.multi-item div.multi-content a > span:has-text("${clearSku}")`,
      //   },
      // ],
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: `div.thumbnail-container > div.product-image > a.product-thumbnail`,
          emptySelector: 'h1:has-text("0 results have been found")',
        },
      ],
      [CheckPageSkuStep, { pageSkuSelector: `div.product-reference:has-text(${clearSku}` }],
      [
        SearchGalleryStep,
        {
          gallerySelector: '#content div.images-container',
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
          containers: [''],
          removeSelectors: [],
          expand: false,
          separator: '\n',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceLasting_1 is finished', {
      component: 'PageImageSourceLasting_1',
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
