import { ITask } from '../../data/entities/ITask';
import { ISource } from './ISource';
import { ISourceDependencies } from './ISourceDependencies';

export interface ISourceDefinition<TTask extends ITask = ITask> {
  create(deps: ISourceDependencies): ISource<TTask>;
}
