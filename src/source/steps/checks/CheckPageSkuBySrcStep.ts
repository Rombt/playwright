import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { getAbsoluteHref } from '../../../common/helpers';

// type CheckPageSkuBySrcParams = {
//   sku: string;
// };

export default class CheckPageSkuBySrcStep extends BaseStep {
  public readonly name = 'CheckPageSkuBySrcStep';

  /**
   *
   * @param ctx
   * @param config
   *
   * для валидации полученной страницы продукта используется src картинки слайдера продукта
   */
  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: CheckPageSkuBySrcParams,
  ): Promise<void> {
    if (!ctx.input.sku || !ctx.input.normalizedSku) {
      throw new Error('SKU or normalizedSku are not defined in context');
    }

    const { page } = ctx;

    const sku = ctx.input.sku;

    const stepConfig = ctx.stepParams?.get(CheckPageSkuBySrcStep) as {
      pageSkuSelector: string;
      token: string;
    };

    const pageSkuSelector = stepConfig?.pageSkuSelector;
    const token = stepConfig?.token;

    if (!pageSkuSelector) {
      throw new Error('pageSkuSelector is not configured in stepParams');
    }

    ctx.logger?.debug('Page sku selector  is received', {
      component: 'CheckPageSkuStep',
      method: 'execute()',
      action: 'ctx.stepParams?.get(CheckPageSkuStep)',
      data: {
        pageSkuSelector: pageSkuSelector,
        token: token,
      },
    });

    let count = 0;
    try {
      const page_sku = page.locator(`${pageSkuSelector}[src*="${token}"]`);
      count = await page_sku.count();

    } catch (error) {
      ctx.control.stop = true;

      ctx.logger.error(`Error by match sku ${sku}`, {
        step: this.name,
        count: count,
        error,
      });
    }

    if (count===0) {
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
