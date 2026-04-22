import { ExecutionContext } from '../../types/ExecutionContext';
import { ISourceEngine } from '../../types/ISourceEngine';
import { IWorkerResult } from '../../../data/entities/IResults/IWorkerResult';
import { IStep } from '../../types/IStep';

export class StepEngine implements ISourceEngine {
  constructor(private steps: IStep[]) {}

  async execute(ctx: ExecutionContext): Promise<IWorkerResult> {
    for (const step of this.steps) {
      if (step.supports?.(ctx) ?? true) {
        ctx.logger.info(`Step started: ${step.name}`);

        await step.run(ctx);

        ctx.logger.info(`Step finished: ${step.name}`);
      }
    }

    return ctx.state.result!;
  }
}
