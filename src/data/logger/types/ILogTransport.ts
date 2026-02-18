import { ILogEntry } from './ILogEntry';

export interface ILogTransport {
  write(entry: ILogEntry): void | Promise<void>;
}
