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
}
