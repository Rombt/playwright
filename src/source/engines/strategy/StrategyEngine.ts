import { ExecutionContext } from '../../types/ExecutionContext';
import { ISourceEngine } from '../../types/ISourceEngine';
import { IWorkerResult } from '../../../data/entities/IResults/IWorkerResult';

export class StrategyEngine implements ISourceEngine {
  async execute(ctx: ExecutionContext): Promise<IWorkerResult> {
    // сюда переносишь текущий pipeline + resolver + стратегии
    ctx.logger.warn('StrategyEngine is not implemented yet');

    if (!ctx.state.result) {
      throw new Error('StrategyEngine: result is not set');
    }

    return ctx.state.result;
  }
}
