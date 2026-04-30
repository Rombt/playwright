import { IStep } from './IStep';
import { IExecutionContext } from './IExecutionContext';

export interface IStepFactory {
  create<T extends IStep = IStep>(name: string): T;

  has(name: string): boolean;

  getAvailableSteps(): string[];
}
