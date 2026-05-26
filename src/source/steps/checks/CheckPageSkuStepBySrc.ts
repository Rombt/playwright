import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { getAbsoluteHref } from '../../../common/helpers';

type CheckPageSkuParams = {
  sku: string;
};

export default class CheckPageSkuStep extends BaseStep {
  public readonly name = 'CheckPageSkuStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: CheckPageSkuParams,
  ): Promise<void> {
    if (!ctx.input.sku || !ctx.input.normalizedSku) {
      throw new Error('SKU or normalizedSku are not defined in context');
    }

    const { page } = ctx;

    const sku = ctx.input.sku;

    const stepConfig = ctx.stepParams?.get(CheckPageSkuStep) as {
      pageSkuSelector: string;
    };
    const pageSkuSelector = stepConfig?.pageSkuSelector;

    if (!pageSkuSelector) {
      throw new Error('pageSkuSelector is not configured in stepParams');
    }

    ctx.logger?.debug('Pag sku selector  is received', {
      component: 'CheckPageSkuStep',
      method: 'execute()',
      action: 'ctx.stepParams?.get(CheckPageSkuStep)',
      data: {
        pageSkuSelector: pageSkuSelector,
      },
    });

    try {
      const page_sku = page.locator(pageSkuSelector, {
        hasText: `${ctx.input.normalizedSku}`,
      });

      await page_sku.first().waitFor({
        state: 'attached',
        timeout: config.asyncRetry.maxDelay,
      });
    } catch {
      ctx.control.stop = true;
      throw new Error(`The page is not match sku ${sku}`);
    }
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('SearchGalleryStep'),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
