import { IStep } from './IStep';

export type IStepConstructor = new (...args: any[]) => IStep<any>;

export type StepParamsMap = Map<IStepConstructor | '*', unknown>;
