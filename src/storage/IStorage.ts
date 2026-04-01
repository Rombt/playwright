import { IDownloadedFile } from '../browser/IDownloadedFile';
import { ILogger } from '../data/logger/types/ILogger';

export interface IStorage {
  save(file: {
    filename: string;
    buffer: Buffer;
    targetDir: string;
    loggerScope?: ILogger;
  }): Promise<void>;

  saveJson<T>(data: T, options: { filename: string; targetDir?: string }): Promise<void>;
  appendJsonUnique<T extends WithSKU>(
    data: T[],
    options: { filename: string; targetDir?: string; baseDir: string },
  ): Promise<void>;
}

export type WithSKU = { sku: string; [key: string]: any };
