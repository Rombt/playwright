import { ILogTransport } from '../types/ILogTransport';
import { ILogEntry } from '../types/ILogEntry';

export class ConsoleTransport implements ILogTransport {
  write(entry: ILogEntry): void {
    const output = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}]${
      entry.contextId ? ` [${entry.contextId}]` : ''
    } ${entry.message}`;
    console.log(output);
  }
}
