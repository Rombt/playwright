import { ISourceDependencies } from '../../types/ISourceDependencies';
import { ISource } from '../../types/ISource';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IFlowRunner } from '../../types/IFlowRunner';
import { ILogger } from '../../../data/logger/types/ILogger';
import { IWorkerResult } from '../../../data/entities/IResults/IWorkerResult';
import { IExecutionContext } from '../../types/IExecutionContext';
import { IDataImag, IDataImagItem } from '../../../data/entities/IDataImag';

import CheckSearchResultsStep from '../../steps/checks/CheckSearchResultsStep';
import CheckPageSkuStep from '../../steps/checks/CheckPageSkuStep';
import SearchGalleryStep from '../../steps/searchElements/SearchGalleryStep';
import CollectImgStep from '../../steps/collectElements/CollectImgStep';
import CollectDescriptionStep from '../../steps/collectElements/CollectDescriptionStep';

import { IExtractHtmlOptions } from '../../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    return new PageImageSourceSalomon(deps.flowRunner);
  },
};

class PageImageSourceSalomon implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website ===
      'https://www.sportovna.com.ua/search/?productsPerPage=24&limiter%5Bfulltext%5D={{sku_prod}}'
    );
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: 'div.card-body > a.s-image-wrapper',
          emptySelector: 'h1',
          emptySelectorText: 'Не знайдено жодного товару',
        },
      ],
      [CheckPageSkuStep, { pageSkuSelector: '[data-product-id]' }],
      [SearchGalleryStep, { gallerySelector: 'div.s-photo-main' }],
      [
        CollectImgStep,
        {
          strategy: 'DefaultCollectImagesStrategy',
          stopProcessing: false,
        },
      ],

      [
        CollectDescriptionStep,
        {
          containers: ['#product_description', '#overview'],
          removeSelectors: ['h2', 'div.video-container'],
          expand: false,
          separator: '\n',
          /* если для получения описания на странице нужно кликнуть по табу */
          tabSelector: '#product_description-tab',
          tabBodySelector: '#product_description',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceSalomon is finished', {
      component: 'PageImageSourceSalomon',
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
