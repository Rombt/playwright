import { IStorage } from '../IStorage';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ILogger } from '../../data/logger/types/ILogger';

export class FileStorage implements IStorage {
  constructor(private readonly baseDir: string) {}

  async save(
    file: { filename: string; buffer: Buffer; targetDir: string },
    loggerScope?: ILogger,
  ): Promise<void> {
    const targetPath = path.join(
      this.trimNonPrintable(this.baseDir),
      this.trimNonPrintable(file.targetDir),
      this.trimNonPrintable(file.filename),
    );

    loggerScope?.debug(`Entering FileStorage.save()`, {
      component: 'FileStorage',
      method: 'save()',
      action: 'start',
      data: {
        targetPath: targetPath,
        file: file,
      },
    });

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.buffer);

      loggerScope?.debug(`File saved successfully`, {
        component: 'FileStorage',
        method: 'save()',
        action: 'fs.writeFile(...)',
        data: {
          targetPath: targetPath,
          file: file,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      loggerScope?.error(`Failed to save file`, {
        component: 'FileStorage',
        method: 'save()',
        action: 'fs.writeFile(...)',
        data: {
          targetPath: targetPath,
          file: file,
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      throw err;
    }
  }

  async saveJson<T>(data: T, options: { filename: string; targetDir?: string }): Promise<void> {
    const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  trimNonPrintable(value: string): string {
    return value.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '');
  }

  composeFileName() {}
}
