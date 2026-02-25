import { ILogEntry } from './ILogEntry';

export interface IRootLogger {
  write(entry: ILogEntry): void;
}
