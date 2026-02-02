import { IDownloadedFile } from '../../browser/IDownloadedFile';
import { Storage } from '../Storage';
import * as path from 'path';
import * as fs from 'fs/promises';

export class FileStorage implements Storage {
  constructor(private readonly baseDir: string) {}

  async save(file: IDownloadedFile): Promise<void> {
    const targetPath = path.join(this.baseDir, file.filename);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    await fs.copyFile(file.path, targetPath);

    // опционально: очистка tmp
    await fs.unlink(file.path);
  }
}
