import { Storage } from '../Storage';
import * as path from 'path';
import * as fs from 'fs/promises';

export class FileStorage implements Storage {
  constructor(private readonly baseDir: string) {}

  async save(file: { filename: string; buffer: Buffer; targetDir: string }): Promise<void> {
    const targetPath = path.join(this.baseDir, file.targetDir, file.filename);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.buffer);
  }
}
