import { ISourceEn } from '../types/ISourceEn';
import { ExecutionContext } from '../types/ExecutionContext';
import { ISourceEngine } from '../types/ISourceEngine';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { ITask } from '../../data/entities/ITask';

export class SourceExample implements ISourceEn<ITask> {
  constructor(private engineFactory: (ctx: ExecutionContext) => ISourceEngine) {}

  supports(task: ITask): boolean {
    return true;
  }

  async execute(ctx: ExecutionContext): Promise<IWorkerResult> {
    const engine = this.engineFactory(ctx);

    ctx.logger.info('Source execution started', {
      url: ctx.input.url,
      engine: ctx.debug.engine,
    });

    const result = await engine.execute(ctx);

    ctx.logger.info('Source execution finished');

    return result;
  }
}
