import { ISource } from '../types/ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IFlowRunner } from '../types/IFlowRunner';
import { ILogger } from '../../data/logger/types/ILogger';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';

import { IExecutionContext, ISourceDependencies } from '../../source';

import CheckSearchResultsStep from '../steps/checks/CheckSearchResultsStep';
import CheckPageSkuStep from '../steps/checks/CheckPageSkuStep';
import SearchGalleryStep from '../steps/searchElements/SearchGalleryStep';
import CollectImgStep from '../steps/collectElements/CollectImgStep';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    return new PageImageSourceNike(deps.flowRunner, deps.logger);
  },
};

class PageImageSourceNike implements ISource<ICollectProductPhotosTask> {
  constructor(private flowRunner: IFlowRunner, private logger: ILogger) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://www.nike.com/fi/w?q={{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'SimilarProductsSearchStrategy',
          linkSelector: '#skip-to-products > div > div > figure > a.product-card__img-link-overlay',
        },
      ],
      [
        CheckPageSkuStep,
        {
          pageSkuSelector:
            '#product-description-container > ul > li[data-testid="product-description-style-color"]',
        },
      ],
      [
        SearchGalleryStep,
        {
          gallerySelector: 'div[data-testid="ImageCarousel"]',
        },
      ],
      [
        CollectImgStep,
        {
          stopProcessing: true,
        },
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceNike is finished', {
      component: 'PageImageSourceNike',
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
