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
    // return new PageImageSourceViking(deps.flowRunner deps.logger);
    return new PageImageSourceViking(deps.flowRunner);
  },
};

class PageImageSourceViking implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website ===
      'https://viking-europe.com/catalogsearch/result/?q={{sku_prod}}'
    );
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    const product = ctx.input.product!;
    const sku = product.sku;
    const images: IDataImag = {};

    const formattedSku = normalizeSku(sku).replace(/^(\d{3})(\d{2})(\d+)$/, '$1/$2/$3');


    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: `a[data-id*="${formattedSku}"]`,
          emptySelector: '#toolbar-amount > span:text-matches("^0$")',
        },
      ],
      [CheckPageSkuStep, {
        pageSkuSelector: 'div.product.attribute.sku > div.value',
        formattedSku: formattedSku,
      }],
      [
        SearchGalleryStep,
        {
          gallerySelector: '[data-gallery-role="gallery"]',
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

      // [
      //   CollectDescriptionStep,
      //   {
      //     containers: ['div.field-product-desc__item.field__item'],
      //     removeSelectors: ['h2', 'div.video'],
      //     expand: false,
      //     separator: '\n',
      //   } satisfies IExtractHtmlOptions,
      // ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceViking is finished', {
      component: 'PageImageSourceViking',
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
