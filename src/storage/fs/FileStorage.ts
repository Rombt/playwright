import { IStorage, WithSKU } from '../IStorage';
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

  async appendJsonUnique<T extends WithSKU>(
    data: T[],
    options: { filename: string; targetDir?: string },
  ): Promise<void> {
    const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    let existingData: T[] = [];

    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      existingData = JSON.parse(content) as T[];
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      // если файла нет — оставляем пустой массив
    }

    // Создаём карту по sku для быстрого поиска
    const existingMap = new Map(existingData.map((item) => [item.sku, item]));

    // Добавляем только новых
    for (const item of data) {
      if (!existingMap.has(item.sku)) {
        existingData.push(item);
        existingMap.set(item.sku, item);
      }
    }

    await fs.writeFile(targetPath, JSON.stringify(existingData, null, 2), 'utf-8');
  }

  trimNonPrintable(value: string): string {
    return value.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '');
  }

  async appendJsonDeep<T extends Record<string, any>>(
    data: T,
    options: { filename: string; targetDir?: string },
  ): Promise<void> {
    const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    let existingData: Record<string, any> = {};

    try {
      const fileContent = await fs.readFile(targetPath, 'utf-8');
      if (fileContent.trim()) {
        existingData = JSON.parse(fileContent);
      }
    } catch {
      // ignore
    }

    const merged = this.deepMergeSafe(existingData, data);

    await fs.writeFile(targetPath, JSON.stringify(merged, null, 2), 'utf-8');
  }

  private deepMergeSafe(target: any, source: any): any {
    // если нет одного из значений
    if (target === undefined) return source;
    if (source === undefined) return target;

    // массивы → дописываем
    if (Array.isArray(target) && Array.isArray(source)) {
      return [...target, ...source];
    }

    // оба объекта → merge
    if (this.isObject(target) && this.isObject(source)) {
      const result: Record<string, any> = { ...target };

      for (const key of Object.keys(source)) {
        result[key] = this.deepMergeSafe(target[key], source[key]);
      }

      return result;
    }

    // ❗ КЛЮЧЕВОЙ МОМЕНТ
    // если типы разные — НЕ трогаем target
    if (typeof target !== typeof source) {
      return target;
    }

    // если одинаковый тип → обновляем
    return source;
  }

  private isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  composeFileName() {}
}
