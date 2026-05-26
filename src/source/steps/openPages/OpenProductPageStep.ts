import { Page } from 'playwright-core';
import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { getAbsoluteHref } from '../../../common/helpers';
import { IProduct } from '../../../data/entities/IProduct';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { IOpenVariantPageParam } from '../../types/IOpenVariantPageParam';

type OpenProductPageParams = {
  strategy: string;
  key: string;
  value: string;
};

export default class OpenProductPageStep extends BaseStep {
  public readonly name = 'OpenProductPageStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: OpenProductPageParams,
  ): Promise<void> {
    const urlProductPage = ctx.state.urlProductPage as string;

    if (!urlProductPage) {
      throw new Error('productUrl is not found in state');
    }

    let page: Page = ctx.page;

    const stepConfig = ctx.stepParams?.get(OpenProductPageStep) as unknown as OpenProductPageParams;

    const strategy = ctx.strategyResolver.get<IOpenVariantPageParam, Page>(stepConfig.strategy);

    if (strategy) {
      page = await strategy.execute(ctx, { urlVariantPage: urlProductPage });
    }

    await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('CheckPageSkuStep'),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
