import { IExecutionContext } from './types/IExecutionContext';
import { IStep } from './types/IStep';

export abstract class BaseStep implements IStep {
  abstract name: string;

  async run(ctx: IExecutionContext): Promise<void> {
    ctx.logger.debug('Step run', {
      step: this.name,
      stage: 'process',
    });

    await this.execute(ctx);
  }

  protected abstract execute(ctx: IExecutionContext): Promise<void>;

  abstract next(ctx: IExecutionContext): IStep | null;
}
