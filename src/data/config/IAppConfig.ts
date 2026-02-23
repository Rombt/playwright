import { LogLevel } from '../logger/types/LogLevel';

export interface IAppConfig {
  async?: AsyncConfig;
  data?: DataConfig;
  browser?: BrowserConfig;
  logger?: LoggerConfig;
}

export interface AsyncConfig {
  retry: RetryConfig;

  tasks: {
    maxTask: number;
  };

  pages: {
    maxPage: number;
    maxWaiters: number;
  };
}

export interface RetryConfig {
  baseDelay: number;
  maxDelay: number;
  maxRetries: number;
}

export interface DataConfig {
  resultsFolder: string;
  sourcesFolder: string;
  brands: string[];
}

export interface BrowserConfig {
  fingerprintFile: string;
}

export interface LoggerConfig {
  level: LogLevel;
  transports?: LoggerTransportConfig[];
  jsonFormat?: boolean;
}

export interface LoggerTransportConfig {
  type: string;
  options?: any;
}
