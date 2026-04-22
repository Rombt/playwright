import { IExecutionContext } from './IExecutionContext';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';

export interface IResultBuilder {
  build(ctx: IExecutionContext): IWorkerResult;
}
