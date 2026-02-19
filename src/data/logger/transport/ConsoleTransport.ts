import { ILogTransport } from '../types/ILogTransport';
import { ILogEntry } from '../types/ILogEntry';

export class ConsoleTransport implements ILogTransport {
  constructor(private pretty = true) {}

  write(entry: ILogEntry): void {
    if (this.pretty) {
      const meta =
        entry.meta && Object.keys(entry.meta).length
          ? `\n${JSON.stringify(entry.meta, null, 2)}`
          : '';

      const line =
        `[${entry.timestamp.toISOString()}] ` +
        `[${entry.level.toUpperCase()}] ` +
        (entry.contextId ? `[${entry.contextId}] ` : '') +
        `${entry.message}` +
        meta;

      console.log(line);
    } else {
      console.log(
        JSON.stringify({
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          contextId: entry.contextId,
          message: entry.message,
          meta: entry.meta ?? {},
        }),
      );
    }
  }
}
