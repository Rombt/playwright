import { ISourceDependencies } from '../types/ISourceDependencies';
import { ISource } from '../types/ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IFlowRunner } from '../types/IFlowRunner';
import { ILogger } from '../../data/logger/types/ILogger';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IExecutionContext } from '../types/IExecutionContext';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';

import CheckSearchResultsStep from '../steps/checks/CheckSearchResultsStep';

export default {
  create(deps: ISourceDependencies): ISource<ICollectProductPhotosTask> {
    // return new PageImageSourceGanzo(deps.flowRunner deps.logger);
    return new PageImageSourceGanzo(deps.flowRunner);
  },
};

class PageImageSourceGanzo implements ISource<ICollectProductPhotosTask> {
  constructor(
    private flowRunner: IFlowRunner, // private logger: ILogger,
  ) {}

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
  }

  async execute(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<IWorkerResult> {
    ctx.stepParams = new Map([
      [
        CheckSearchResultsStep,
        {
          linkSelector:
            '#block-personal-content > div > div > div > div > div > div > div > div.product-teaser__top > div > div.product-teaser__image--wrapper > a',
          emptySelector: '.view-empty > p',
        },
      ],
      // [ExtractImagesStep, { format: 'webp' }],
      // [SaveStep, { compress: true }],
      // ['*', { retry: 2 }], // глобальный fallback
    ]);

    // const startStep = ctx.stepFactory.create('GanzoFlowStep');
    const startStep = ctx.stepFactory.create('OpenSearchPageStep');

    await this.flowRunner.run(startStep, ctx);

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
