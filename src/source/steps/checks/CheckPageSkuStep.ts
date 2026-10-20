import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { getAbsoluteHref } from '../../../common/helpers';
import { FatalError } from '../../../data/entities/Errors/FatalError';

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
      throw new FatalError('SKU or normalizedSku are not defined in context');
    }

    const { page } = ctx;
    const stepConfig = ctx.stepParams?.get(CheckPageSkuStep) as {
      pageSkuSelector: string;
      formattedSku: string;
    };

    const pageSkuSelector = stepConfig?.pageSkuSelector;
    const formattedSku = stepConfig?.formattedSku;

    if (!pageSkuSelector) {
      throw new FatalError('pageSkuSelector is not configured in stepParams');
    }

    ctx.logger?.debug('Page sku selector  is received', {
      component: 'CheckPageSkuStep',
      method: 'execute()',
      action: 'ctx.stepParams?.get(CheckPageSkuStep)',
      data: {
        ctx: ctx,
        pageSkuSelector: pageSkuSelector,
        ctxInputNormalizedSku: ctx.input.normalizedSku,
        formattedSku: formattedSku,
      },
    });

    const pageSku = page.locator(pageSkuSelector);
    await pageSku.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
    // await pageSku.scrollIntoViewIfNeeded();
    const text = await pageSku.textContent();
    let sku = '';

    // если sku на странице представлено в оригинальном виде. Как здесь на пример https://viking-europe.com/bielizna-damska-viking-etna-2-0-lady-pants-bamboo-czarno-fioletowa-500-27-6048-0948/
    if (formattedSku) {
      sku = formattedSku;
    } else {
      sku = ctx.input.normalizedSku;
    }

    try {
      if (!text?.toLowerCase().includes(sku.toLowerCase())) {
        throw new FatalError(`SKU mismatch. Expected: ${sku}, found: ${text}`);
      }
    } catch (e) {
      ctx.control.stop = true;
      throw new FatalError(`The page is not match sku ${sku}`);
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
