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

import { normalizeSku, IExtractHtmlOptions } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    // return new PageImageSourceRagnarok(deps.flowRunner deps.logger);
    return new PageImageSourceRagnarok(deps.flowRunner);
  },
};

class PageImageSourceRagnarok implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website === 'https://tactical-belt.store/ru/katalog/search/?q={{sku_prod}}'
    );
  }
  
  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    const product = ctx.input.product!;
    const sku = product.sku;
    const images: IDataImag = {};


    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: 'div.catalogCard-main > div > div.catalogCard-view > a',
          emptySelector: '[data-catalog-view-block="products"] > p',
          emptySelectorText: 'Нет товаров',
        },
      ],
      [
        CheckPageSkuStep,
        {
          pageSkuSelector: 'div.product-header__code',
        },
      ],
      [
        SearchGalleryStep,
        {
          gallerySelector: 'div.gallery__photos-container',
        },
      ],
      [
        CollectImgStep,
        {
          // strategy: 'SlickSliderCollectImagesStrategy',
          strategy: 'DefaultCollectImagesStrategy',
          stopProcessing: false,
        },
      ],

      [
        CollectDescriptionStep,
        {
          containers: ['div.product-features'],
          removeSelectors: [],
          expand: false,
          separator: '\n',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceRagnarok is finished', {
      component: 'PageImageSourceRagnarok',
      method: 'execute()',
      action: 'await this.flowRunner.run(startStep, ctx)',
      data: {
        ctx: ctx,
      },
    });

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
