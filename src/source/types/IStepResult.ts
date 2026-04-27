import { IStep } from './IStep';

export interface IStepResult {
  step: IStep<any>;
  params?: unknown;
}
