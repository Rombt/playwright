import { ExecutionContext } from './ExecutionContext';

export interface IStep {
  name: string;

  run(ctx: ExecutionContext): Promise<void>;

  supports?(ctx: ExecutionContext): boolean;
}
