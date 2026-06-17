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

import { IExtractHtmlOptions } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    return new PageImageSourceJoma(deps.flowRunner);
  },
};

class PageImageSourceJoma implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://joma.ua/search/?q={{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: 'main > div.categories > div.category > div.category-content > div > a',
          emptySelector: 'h1',
          emptySelectorText: 'Не знайдено жодного товару',
        },
      ],
      [
        CheckPageSkuStep,
        { pageSkuSelector: 'main > div.product > div.product__column.product__column_right > h4' },
      ],
      [
        SearchGalleryStep,
        {
          gallerySelector:
            'main > div.product > div.product__column.product__column_left > div.slider',
        },
      ],
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
          containers: [
            'main > div.product > div.product__column.product__column_left > div.product__description',
          ],
          removeSelectors: [],
          expand: false,
          separator: '\n',
          /* если для получения описания на странице нужно кликнуть по табу */
          // tabSelector: '#product_description-tab',
          // tabBodySelector: '#product_description',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceJoma is finished', {
      component: 'PageImageSourceJoma',
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
