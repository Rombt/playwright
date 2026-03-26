import { ILogTransport } from '../types/ILogTransport';
import { ILogEntry } from '../types/ILogEntry';
import * as fs from 'fs';
import * as path from 'path';

export class FileTransport implements ILogTransport {
  private filePath: string;

  constructor(filePath: string, private pretty = false) {
    this.filePath = path.resolve(filePath);

    // 1. Гарантируем существование директории (включая вложенные)
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    // 2. Гарантируем существование файла (без перезаписи)
    fs.writeFileSync(this.filePath, '', { flag: 'a' });
  }

  write(entry: ILogEntry): void {
    let meta;
    let line;

    if (this.pretty) {
      meta =
        entry.meta && Object.keys(entry.meta).length
          ? `\n${JSON.stringify(entry.meta, null, 2)}`
          : '';

      line =
        `[${entry.timestamp.toISOString()}] ` +
        `[${entry.level.toUpperCase()}] ` +
        (entry.contextId ? `[${entry.contextId}] ` : '') +
        `${entry.message}` +
        meta +
        '\n\n';
    } else {
      line =
        JSON.stringify({
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          contextId: entry.contextId,
          message: entry.message,
          meta: entry.meta ?? {},
        }) + '\n';
    }

    try {
      fs.appendFileSync(this.filePath, line, 'utf8');
    } catch {
      // Logger deliberately swallows transport errors
    }
  }
}
