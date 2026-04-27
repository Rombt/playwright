import { IExecutionContext } from '../../types/IExecutionContext';
import { IStep } from '../../types/IStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';

type CheckSearchResultsParams = {
  sku: string;
};

export default class CheckSearchResultsStep implements IStep<CheckSearchResultsParams> {
  public readonly name = 'CheckSearchResultsStep';

  async run(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: CheckSearchResultsParams,
  ): Promise<void> {
    const { page } = ctx;

    if (!params?.sku) {
      throw new Error('SKU is required');
    }

    const sku = params.sku;

    const stepConfig = ctx.stepParams?.get(CheckSearchResultsStep) as {
      linkSelector: string;
      emptySelector?: string;
    };

    if (!stepConfig?.linkSelector) {
      throw new Error('linkSelector is not configured in stepParams');
    }

    const link = page.locator(stepConfig.linkSelector).first();

    const empty = page.locator(stepConfig.emptySelector ?? '.view-empty');

    try {
      await Promise.race([
        link.waitFor({ state: 'visible', timeout: config.asyncRetry.maxDelay }),
        empty.waitFor({ state: 'visible', timeout: config.asyncRetry.maxDelay }),
      ]);
    } catch {
      throw new Error(`Search result not resolved. ${sku}`);
    }

    if ((await empty.count()) > 0) {
      throw new Error(`Goods not found on the page. ${sku}`);
    }
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('FindProductLinkStep'),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
