import { ILogger } from './types/ILogger';
import { ILoggerConfig } from './types/ILoggerConfig';
import { ILogEntry } from './types/ILogEntry';
import { LogLevel } from './types/LogLevel';
import { ILogTransport } from './types/ILogTransport';
import { ScopedLogger } from './ScopedLogger';
import { IRootLogger } from './types/IRootLogger';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class Logger implements ILogger, IRootLogger {
  private static instance: Logger | null = null;

  private readonly level: LogLevel;
  private readonly transports: ILogTransport[];

  private constructor(config: ILoggerConfig) {
    this.level = config.level;
    this.transports = config.transports;
  }

  public static init(config: ILoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      throw new Error('Logger is not initialized');
    }
    return Logger.instance;
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  public log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: ILogEntry = {
      timestamp: new Date(),
      level,
      message,
      meta,
    };

    this.write(entry);
  }

  public withContext(contextId: string): ILogger {
    return new ScopedLogger(this, contextId);
  }

  public write(entry: ILogEntry): void {
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch {
        // Logger deliberately swallows transport errors
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level];
  }
}
