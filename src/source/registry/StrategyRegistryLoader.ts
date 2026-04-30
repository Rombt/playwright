import * as fs from 'fs';
import * as path from 'path';
import { IStrategy } from '../types/IStrategy';

export class StrategyRegistryLoader {
  private registry = new Map<string, IStrategy<any, any>>();

  constructor(private strategiesFolder: string) {}

  async load(): Promise<Map<string, IStrategy<any, any>>> {
    const files = this.getAllFiles(this.strategiesFolder);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

      const module = await import(file);
      const StrategyClass = module.default;

      if (!StrategyClass) continue;

      const instance: IStrategy<any, any> = new StrategyClass();

      if (!instance.name) {
        throw new Error(`Strategy missing name: ${file}`);
      }

      if (this.registry.has(instance.name)) {
        throw new Error(`Duplicate strategy name: ${instance.name}`);
      }

      this.registry.set(instance.name, instance);
    }

    return this.registry;
  }

  get(name: string): IStrategy<any, any> | undefined {
    return this.registry.get(name);
  }

  getAll(): Map<string, IStrategy<any, any>> {
    return this.registry;
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  private getAllFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
