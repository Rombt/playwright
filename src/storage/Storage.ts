import { IDownloadedFile } from '../browser/IDownloadedFile';

export interface Storage {
  save(file: { filename: string; buffer: Buffer; targetDir: string }): Promise<void>;
}
