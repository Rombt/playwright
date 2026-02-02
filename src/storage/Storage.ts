import { IDownloadedFile } from '../browser/IDownloadedFile';

export interface Storage {
  save(file: IDownloadedFile): Promise<void>;
}
