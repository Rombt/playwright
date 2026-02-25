import { ILogEntry } from './ILogEntry';

export interface ILogFormatter {
  format(entry: ILogEntry): string;
}
