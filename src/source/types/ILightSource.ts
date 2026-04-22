import { IExecutionContext } from './IExecutionContext';

export interface ILightSource {
  execute(ctx: IExecutionContext): Promise<void>;
}
