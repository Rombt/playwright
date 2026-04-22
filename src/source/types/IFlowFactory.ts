import { IStep } from './IStep';

export interface IFlowFactory {
  create(): IStep;
}
