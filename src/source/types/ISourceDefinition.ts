import { ITask } from '../../data/entities/ITask';
import { ISource } from './ISource';

export interface ISourceDefinition<TTask extends ITask = ITask> {
  create(deps: ISourceDependencies): ISource<TTask>;
}
