import { LogLevel } from './LogLevel';
import { ILogTransport } from './ILogTransport';

export interface ILoggerConfig {
  level: LogLevel;
  transports: ILogTransport[];
}
