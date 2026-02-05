import { IDownloadedFile } from '../browser/IDownloadedFile';

export interface Storage {
  save(file: { filename: string; buffer: Buffer; targetDir: string }): Promise<void>;

  saveJson<T>(data: T, options: { filename: string; targetDir?: string }): Promise<void>;
}
