import { ExecutionContext } from './ExecutionContext';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';

export interface ISourceEngine {
  execute(ctx: ExecutionContext): Promise<IWorkerResult>;
}
