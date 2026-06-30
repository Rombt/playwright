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
import PreparationSearchPageStep from '../steps/preparationPage/PreparationSearchPageStep';
import OpenSearchPageStep from '../steps/openPages/OpenSearchPageStep';

import { IExtractHtmlOptions } from '../../common/helpers';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    return new PageImageSourceEmporioArmani(deps.flowRunner);
  },
};

class PageImageSourceEmporioArmani implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://www.armani.com/en-wx';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    ctx.stepParams = new Map([
      [
        OpenSearchPageStep,
        {
          nextStep: 'PreparationSearchPageStep',
        },
      ],

      [
        PreparationSearchPageStep,
        {
          openInputSelector: '#ab-header-container ul [aria-label="Search"]',
          inputSelector: 'input#search',
          strategy: 'InsertValueIntoInputStrategy',
          useWaitForSystemToCoolDown: true,
          minFreeMemMB: 800,
          maxCpuLoad: 0.5,
          maxDelay: 10000,
          timeoutMs: 90000,
          scrollIntoViewIfNeeded: false,
        },
      ],
      [
        CheckSearchResultsStep,
        {
          strategy: 'DefaultSearchResultsStrategy',
          linkSelector: `a[href*="${ctx.input.normalizedSku}"]`,
          // emptySelector: 'h1',
          // emptySelectorText: 'Не знайдено жодного товару',
        },
      ],
      [
        CheckPageSkuStep,
        {
          pageSkuSelector:
            '#headlessui-dialog-panel-v-0-0-1-0-10 > div.flex-1.overflow-y-auto.positive-padding > div > div:nth-child(4) > div',
        },
      ],
      //
      [SearchGalleryStep, { gallerySelector: 'div.gallery-slider' }],
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
            '#headlessui-dialog-panel-v-0-0-1-0-16 > div.flex-1.overflow-y-auto.positive-padding > div',
          ],
          removeSelectors: ['h3', 'button', 'xpath=//h3[contains(., "Product code")]/..'],
          expand: false,
          separator: '\n',
          /* если для получения описания на странице нужно кликнуть по табу */
          //
          tabSelector:
            '#pdp-main-block > div.grid-standard.bg-primitives-off-white.giorgioArmaniHeaderPaddingTop.lg:pb-lg.relative.lg:items-start > div.order-3.col-span-full.lg:col-start-10.lg:col-end-13.lg:flex.lg:h-full.lg:flex-col > div > div > div.py-md.flex.h-full.flex-col.justify-between.lg:gap-6.lg:py-0.xl:gap-16 > div > div.flex.flex-col > button:nth-child(1)',
          tabBodySelector: '#headlessui-dialog-panel-v-0-0-1-0-22',
        } satisfies IExtractHtmlOptions,
      ],
      // ['*', { retry: 2 }], // глобальный fallback
    ] as Array<[any, any]>);

    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

    ctx.logger?.debug('Processing of the PageImageSourceEmporioArmani is finished', {
      component: 'PageImageSourceEmporioArmani',
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
