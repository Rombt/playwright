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
import CheckPageSkuBySrcStep from '../steps/checks/CheckPageSkuBySrcStep';
import OpenProductPageStep from '../steps/openPages/OpenProductPageStep';
import SearchGalleryStep from '../steps/searchElements/SearchGalleryStep';
import CollectImgStep from '../steps/collectElements/CollectImgStep';
import CollectDescriptionStep from '../steps/collectElements/CollectDescriptionStep';
import PreparationSearchPageStep from '../steps/preparationPage/PreparationSearchPageStep';

import { IExtractHtmlOptions } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    // return new PageImageSourceUnderArmour(deps.flowRunner deps.logger);
    return new PageImageSourceUnderArmour(deps.flowRunner);
  },
};

class PageImageSourceUnderArmour implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website === 'https://www.underarmour.com/en-us/search/?q={{sku_prod}}'
    );
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    const product = ctx.input.product;

    if (!product) {
      throw new Error('Product is missing');
    }
    
    const sku = ctx.input.product?.sku;

    if (typeof sku !== 'string') {
      throw new Error('Invalid SKU');
    }

    const [left_part_sku] = sku.split('*');
    const [key, value] = left_part_sku.split('-');

    ctx.stepParams = new Map([
      [
        OpenSearchPageStep,
        {
          clearSku: 'full',
          nextStep: 'PreparationSearchPageStep',
        },
      ],
      [
        PreparationSearchPageStep,
        {
          selector: 'button.uawc-close-button',
          strategy: 'SimpleClickStrategy',
        },
      ],
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: '[data-testid="product-tile-container"]>a',
          emptySelector: '[data-testid="empty-search-result"]',
        },
      ],
      [
        OpenProductPageStep,
        {
          strategy: 'GetUrlVariantPageStrategy',
          // для перехода на страницу варианта
          key: `dwvar_${key}_color`,
          value: value,
          nextStep: 'CheckPageSkuBySrcStep',
        },
      ],
      [
        CheckPageSkuBySrcStep,
        {
          pageSkuSelector: 'div.swiper-wrapper img',
          token: left_part_sku,
        },
      ],
      [
        SearchGalleryStep,
        {
          gallerySelector: 'div.swiper-wrapper',
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
          containers: ['div.field-product-desc__item.field__item'],
          removeSelectors: ['h2', 'div.video'],
          expand: false,
          separator: '\n',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceUnderArmour is finished', {
      component: 'PageImageSourceUnderArmour',
      method: 'execute()',
      action: 'await this.flowRunner.run(startStep, ctx)',
      data: {
        ctx: ctx,
      },
    });

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
