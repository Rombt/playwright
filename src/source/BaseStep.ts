import { IExecutionContext } from './types/IExecutionContext';
import { IStep } from './types/IStep';
import { IStepResult } from './types/IStepResult';
import { AppConfig } from '../data/config/appConfig';

export abstract class BaseStep implements IStep {
  abstract name: string;

  async run(ctx: IExecutionContext, config: AppConfig, params?: unknown): Promise<void> {
    ctx.logger.debug('Step run', {
      step: this.name,
      stage: 'process',
      params,
    });

    await this.execute(ctx, config, params);
  }

  protected abstract execute(
    ctx: IExecutionContext,
    config: AppConfig,
    params?: unknown,
  ): Promise<void>;

  abstract next(ctx: IExecutionContext, config: AppConfig): IStepResult | null;
}
