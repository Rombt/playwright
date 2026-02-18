import { LogLevel } from './LogLevel';

export interface ILogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;

  withContext(contextId: string): ILogger;
}
