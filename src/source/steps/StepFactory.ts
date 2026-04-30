import { IStep } from '../types/IStep';
import { StepRegistryLoader } from '../registry/StepRegistryLoader';
import { IExecutionContext } from '../types/IExecutionContext';
import { IStepFactory } from '../types/IStepFactory';

type StepConstructor<T extends IStep = IStep> = new () => T;

export class StepFactory implements IStepFactory {
  constructor(private registry: StepRegistryLoader) {}

  create<T extends IStep = IStep>(name: string): T {
    if (!this.registry.has(name)) {
      throw new Error(`Step not registered: ${name}`);
    }

    const StepClass = this.registry.get(name) as StepConstructor<T>;

    return new StepClass();
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  getAvailableSteps(): string[] {
    return Array.from(this.registry.getAll().keys());
  }
}
