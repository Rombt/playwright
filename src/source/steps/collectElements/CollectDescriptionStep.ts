import { Locator } from 'playwright-core';
import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { IExtractHtmlOptions, extractRawHtml } from '../../../common/helpers';

// type CollectDescriptionStepParams = {
//   sku: string;
// };

export default class CollectDescriptionStep extends BaseStep {
  public readonly name = 'CollectDescriptionStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: CollectDescriptionStepParams,
  ): Promise<void> {
    const { page } = ctx;
    let html: string = '';

    //!! Для сбора описаний на разных сайтах использовать СТРАТЕГИИ а не делать новые шаги аналогично этому

    const stepConfig = ctx.stepParams?.get(CollectDescriptionStep) as IExtractHtmlOptions;

    try {
      ctx.state.html = await extractRawHtml(page, stepConfig);
    } catch (error) {
      throw new Error(`Description is absent for ${ctx.input.url}`);
    }

    ctx.control.stop = true;
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create(''), //!!!!
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
