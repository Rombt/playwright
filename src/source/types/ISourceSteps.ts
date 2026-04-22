import { ITask } from '../../data/entities/ITask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IExecutionContext } from './IExecutionContext';

export interface ISource<TTask extends ITask = ITask> {
  supports(task: TTask): boolean;

  execute(ctx: IExecutionContext<TTask>): Promise<IWorkerResult>;
}
