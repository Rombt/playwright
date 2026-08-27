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
import longSku4F from '../../data/4F_long_sku.json';

import { IExtractHtmlOptions, normalizeSku, fullClearSku } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    // return new PageImageSource4F(deps.flowRunner deps.logger);
    return new PageImageSource4F_1(deps.flowRunner);
  },
};

class PageImageSource4F_1 implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://md-fashion.ua/ru/store?s={{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    // т.к. товары ТМ 4F ищутся только по полным squ то нужно получить их все доступные
    // выбрать из них тот частью которого является текущий, короткий, sku и
    // в дальнейшем использовать только длинный
    const arr_longSku = [...new Set(longSku4F)];

    if (!ctx.input.product) {
      throw new Error('!ctx.input.product');
    }

    const shortSku = normalizeSku(ctx.input.product.sku);
    const foundLongSku = arr_longSku.find((sku) => sku.includes(shortSku));

    if (!foundLongSku) {
      throw new Error('Long sku is not found');
    }

    ctx.input.product.sku = foundLongSku;

    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: 'div.product-list a.products-item__link',
          emptySelector: 'div.no-result > h2.no-result__title',
        },
      ],
      [CheckPageSkuStep, { pageSkuSelector: 'h1 > span' }],
      [
        SearchGalleryStep,
        {
          gallerySelector: 'div.product_images',
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
          containers: ['div.product_description'],
          removeSelectors: ['div.specs_section_head', 'div.product-article'],
          expand: false,
          separator: '\n',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSource4F_1 is finished', {
      component: 'PageImageSource4F_1',
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
