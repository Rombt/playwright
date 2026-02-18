import { LogLevel } from './LogLevel';

export interface ILogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  contextId?: string;
  meta?: Record<string, unknown>;
}
