import { ISourceEngine } from './types/ISourceEngine';
import { StrategyEngine } from './engines/strategy/StrategyEngine';
import { StepEngine } from './engines/step/StepEngine';
import { IStep } from './types/IStep';

import { ExecutionContext } from './types/ExecutionContext';
import { IWorkerResult } from './../data/entities/IResults/IWorkerResult';

type EngineType = 'strategy' | 'step';

export function createEngine(type: EngineType, steps: IStep[]): ISourceEngine {
  switch (type) {
    case 'strategy':
      return new StrategyEngine();

    case 'step':
      return new StepEngine(steps);

    default:
      throw new Error(`Unknown engine: ${type}`);
  }
}
