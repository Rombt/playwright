import { Locator } from 'playwright-core';
import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { getAbsoluteHref } from '../../../common/helpers';

type CollectImagesResult = {
  absoluteImageUrls: string[];
};

type CollectImgStepConfig = {
  stopProcessing: boolean;
  strategy: string;
};

export default class CollectImgStep extends BaseStep {
  public readonly name = 'CollectImgStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    // params?: CollectImgStepParams,
  ): Promise<void> {
    const { page } = ctx;

    const stepConfig = ctx.stepParams?.get(CollectImgStep) as unknown as CollectImgStepConfig;

    const strategy = ctx.strategyResolver.get<CollectImgStepConfig, CollectImagesResult>(
      stepConfig.strategy,
    );

    const result = await strategy.execute(ctx, stepConfig);

    if (ctx.state.images === undefined) {
      ctx.state.images = [];
    }

    ctx.state.images?.push(...result.absoluteImageUrls);

    // если источник не содержит описания товаров
    if (stepConfig.stopProcessing === true) {
      ctx.control.stop = true;
    }
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
