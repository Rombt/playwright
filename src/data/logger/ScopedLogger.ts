import { IScopedLogger } from './types/IScopedLogger';
import { IRootLogger } from './types/IRootLogger';
import { ILogEntry } from './types/ILogEntry';
import { LogLevel } from './types/LogLevel';

export class ScopedLogger implements IScopedLogger {
  private readonly root: IRootLogger;
  private readonly contextId: string;

  constructor(root: IRootLogger, contextId: string) {
    this.root = root;
    this.contextId = contextId;
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: ILogEntry = {
      timestamp: new Date(),
      level,
      message,
      contextId: this.contextId,
      meta,
    };

    this.root.write(entry);
  }

  withContext(): never {
    throw new Error('ScopedLogger context is immutable');
  }
}
