// import { Page, Locator } from 'playwright-core';
import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { getAbsoluteHref } from '../../../common/helpers';
import { IProduct } from '../../../data/entities/IProduct';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';

// type OpenProductPageParams = {
//   product?: IProduct;
// };

export default class OpenProductPageStep extends BaseStep {
  public readonly name = 'OpenProductPageStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: OpenProductPageParams,
  ): Promise<void> {
    const urlProductPage = ctx.state.urlProductPage as string;

    if (!urlProductPage) {
      throw new Error('productUrl is not found in state');
    }

    await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create(''),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
