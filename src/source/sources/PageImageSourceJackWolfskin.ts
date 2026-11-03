import { ISourceDependencies } from '../types/ISourceDependencies';
import { ISource } from '../types/ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IFlowRunner } from '../types/IFlowRunner';
import { ILogger } from '../../data/logger/types/ILogger';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IExecutionContext } from '../types/IExecutionContext';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';
import { existsSync, readFileSync } from 'node:fs';

import CheckSearchResultsStep from '../steps/checks/CheckSearchResultsStep';
import CheckPageSkuStep from '../steps/checks/CheckPageSkuStep';
import SearchGalleryStep from '../steps/searchElements/SearchGalleryStep';
import CollectImgStep from '../steps/collectElements/CollectImgStep';
import CollectDescriptionStep from '../steps/collectElements/CollectDescriptionStep';

import { IExtractHtmlOptions, normalizeSku, fullClearSku } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    return new PageImageSourceJackWolfskin(deps.flowRunner);
  },
};

class PageImageSourceJackWolfskin implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://www.jack-wolfskin.com/search/?q={{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    if (!ctx.input.product) {
      throw new Error('!ctx.input.product');
    }

    // т.к. товары ТМ JackWolfskin ищутся только по полным squ то нужно получить их все доступные
    // выбрать из них тот частью которого является текущий, короткий, sku и
    // в дальнейшем использовать только длинный
    const filePath = 'src/data/sku/jackWolfskin/jackWolfskin_full_sku.json';

    let arr_longSku: string[] = [];

    if (existsSync(filePath)) {
      const data: string[] = JSON.parse(readFileSync(filePath, 'utf-8'));

      arr_longSku = [...new Set(data)];
    }

    const shortSku = normalizeSku(ctx.input.product.sku);
    const foundLongSku = arr_longSku.find((sku) => sku.includes(shortSku));

    if (!foundLongSku) {
      throw new Error('Long sku is not found');
    }

    ctx.input.product.sku = foundLongSku;

    // ctx.logger?.debug('************************', {
    //   component: '',
    //   method: '',
    //   action: '',
    //   data: {
    //     ctxInputProductSku: ctx.input.product.sku,
    //   },
    // });

    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: `#voyado-search > div > div.v-grid > div.v-product-card > div.v-image-wrapper > a[href*="${normalizeSku(ctx.input.product.sku)}" i]`,
          emptySelector: 'h1',
          emptySelectorText: 'We’ve got sidetracked somehow',
        },
      ],
      [
        CheckPageSkuStep,
        {
          pageSkuSelector:
            '#ProductInformation-template--27214413037892__main > div > div.group-block-content.layout-panel-flex.layout-panel-flex--column.custom- > div.product-description > details > div > product-article-ref-component > p > span:nth-child(2)',
        },
      ],
      [
        SearchGalleryStep,
        {
          gallerySelector:
            '#shopify-section-template--27214413037892__main > div.product-information.section.section--page-width.spacing-style.color-scheme-1.relative > div > div.product-information__media > media-gallery > ul',
        },
      ],
      [
        CollectImgStep,
        {
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

    ctx.logger?.debug('Processing of the PageImageSourceJackWolfskin is finished', {
      component: 'PageImageSourceJackWolfskin',
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
