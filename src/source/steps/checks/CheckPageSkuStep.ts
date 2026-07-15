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
    const stepConfig = ctx.stepParams?.get(CheckPageSkuStep) as { pageSkuSelector: string };
    const pageSkuSelector = stepConfig?.pageSkuSelector;

    if (!pageSkuSelector) {
      throw new Error('pageSkuSelector is not configured in stepParams');
    }

    ctx.logger?.debug('Page sku selector  is received', {
      component: 'CheckPageSkuStep',
      method: 'execute()',
      action: 'ctx.stepParams?.get(CheckPageSkuStep)',
      data: {
        ctx: ctx,
        pageSkuSelector: pageSkuSelector,
        ctxInputNormalizedSku: ctx.input.normalizedSku,
      },
    });

    const pageSku = page.locator(pageSkuSelector);
    await pageSku.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
    // await pageSku.scrollIntoViewIfNeeded();
    const text = await pageSku.textContent();

    try {
      if (!text?.toLowerCase().includes(ctx.input.normalizedSku.toLowerCase())) {
        throw new Error(`SKU mismatch. Expected: ${ctx.input.normalizedSku}, found: ${text}`);
      }
    } catch (e) {
      ctx.control.stop = true;
      throw new Error(`The page is not match sku ${ctx.input.normalizedSku}`);
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
