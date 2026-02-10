import { Storage } from '../Storage';
import * as path from 'path';
import * as fs from 'fs/promises';

export class FileStorage implements Storage {
  constructor(private readonly baseDir: string) {}

  async save(file: { filename: string; buffer: Buffer; targetDir: string }): Promise<void> {
    const targetPath = path.join(
      this.trimNonPrintable(this.baseDir),
      this.trimNonPrintable(file.targetDir),
      this.trimNonPrintable(file.filename),
    );

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.buffer);
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
