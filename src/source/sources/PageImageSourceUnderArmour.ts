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
import OpenProductPageStep from "../steps/openPages/OpenProductPageStep";
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

    const [left] = sku.split('*');
    const [key, value] = left.split('-');
    
    
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
          strategy: 'SimpleClick',
        },
      ],
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: '#product-1376700-002-S/M-FPP > a',
          emptySelector: '[data-testid="empty-search-result"]',
        },
      ],
      [
        OpenProductPageStep, // переход на страницу варианта
        {
          strategy: 'OpenPageVariant',
          key: `dwvar_${key}_color`,
          value: value,
        },
      ],
      [
        CheckPageSkuStep,
        { pageSkuSelector: 'div.product-full__code div.field-product-vendor-code__item' },
      ],
      [
        SearchGalleryStep,
        {
          gallerySelector:
            '#block-personal-content > div > div > div > div.product-full__top > div.product-full__top--left.product-full__top-item > div.product-full__gallery.swiper-arrow-style-2.swiper-arrow-style-min > div > div.product-gl__images',
        },
      ],
      CollectImgStep,
      {
        strategy: 'DefaultCollectImagesStrategy',
        stopProcessing: true,
      },

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
