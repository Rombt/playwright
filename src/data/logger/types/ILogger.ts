import { LogLevel } from './LogLevel';
import { LogMeta } from './LogMeta';

export interface ILogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;

  log(level: LogLevel, message: string, meta?: LogMeta): void;

  withContext(contextId: string): ILogger;
}
