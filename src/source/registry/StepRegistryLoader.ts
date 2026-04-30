import * as fs from 'fs';
import * as path from 'path';

export class StepRegistryLoader {
  private registry = new Map<string, any>();

  constructor(private stepsPath: string) {}

  async load(): Promise<Map<string, any>> {
    const files = this.getAllFiles(this.stepsPath);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

      const module = await import(file);

      const StepClass = module.default;

      if (!StepClass) continue;

      const instance = new StepClass();

      if (!instance.name) {
        throw new Error(`Step missing name: ${file}`);
      }

      this.registry.set(instance.name, StepClass);
    }

    return this.registry;
  }

  get(name: string): any {
    const StepClass = this.registry.get(name);

    if (!StepClass) {
      throw new Error(`Step not found: ${name}`);
    }

    return StepClass;
  }

  getAll(): Map<string, any> {
    return this.registry;
  }

  public has(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

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
