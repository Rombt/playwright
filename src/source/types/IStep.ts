import { IExecutionContext } from './IExecutionContext';
import { AppConfig } from '../../data/config/appConfig';
import { IStepResult } from './IStepResult';

export interface IStep<TParams = unknown> {
  name: string;

  run(ctx: IExecutionContext, config: AppConfig, params?: TParams): Promise<void>;

  next(ctx: IExecutionContext, config: AppConfig): IStepResult | null;
}
