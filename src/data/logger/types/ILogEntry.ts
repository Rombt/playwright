import { LogLevel } from './LogLevel';
import { LogMeta } from './LogMeta';

export interface ILogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  contextId?: string;
  meta?: LogMeta;
}
