import { ISourceDependencies } from '../types/ISourceDependencies';
import { ISource } from '../types/ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IFlowRunner } from '../types/IFlowRunner';
import { ILogger } from '../../data/logger/types/ILogger';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IExecutionContext } from '../types/IExecutionContext';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';
import OpenSearchPageStep from '../steps/openPages/OpenSearchPageStep';
import CheckSearchResultsStep from '../steps/checks/CheckSearchResultsStep';
import CheckPageSkuStep from '../steps/checks/CheckPageSkuStep';
import SearchGalleryStep from '../steps/searchElements/SearchGalleryStep';
import CollectImgStep from '../steps/collectElements/CollectImgStep';
import CollectDescriptionStep from '../steps/collectElements/CollectDescriptionStep';

import { IExtractHtmlOptions } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    return new PageImageSourceAlpineCrown(deps.flowRunner);
  },
};

class PageImageSourceAlpineCrown implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website === 'https://alpine-crown.com/?s={{sku_prod}}&post_type=product'
    );
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    ctx.stepParams = new Map([
      // [
      //   OpenSearchPageStep,
      //   {
      //     nextStep: 'CheckPageSkuStep',
      //   },
      // ],

      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          // linkSelector: 'ul.products > li.type-product > a',
          // linkSelector: `ul.products a:has(img[src*="${ctx.input.sku}"])`,
          linkSelector: `a:has(> div:first-child img[src*="${ctx.input.sku}"])`,
          emptySelector: 'div.woocommerce-no-products-found > .woocommerce-info',
          emptySelectorText: 'Товарів, відповідних вашому запиту, не знайдено',
        },
      ],
      [CheckPageSkuStep, { pageSkuSelector: 'div.variation-sku > span' }],
      [
        SearchGalleryStep,
        {
          gallerySelector: 'div.product-gallery-main-shell > div.swiper-wrapper',
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
            'h3:has-text("Technical specifications") >> ..',
            'h3:has-text("Технічні характеристики") >> ..',
          ],
          removeSelectors: ['h2'],
          expand: false,
          separator: '\n',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceAlpineCrown is finished', {
      component: 'PageImageSourceAlpineCrown',
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
