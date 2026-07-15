import { LogLevel } from '../logger/types/LogLevel';
import { IBrowserMode } from '../../browser/IBrowserMode';

export interface IAppConfig {
  async: AsyncConfig;
  data: DataConfig;
  browser: BrowserConfig;
  logger: LoggerConfig;
}

export interface AsyncConfig {
  retry: RetryConfig;

  tasks: {
    maxTask: number;
  };

  pages: {
    maxPage: number;
    maxPageDownloadImg: number;
    maxWaiters: number;
    pageLoadWait: number;
  };
}

export interface RetryConfig {
  baseDelay: number;
  maxDelay: number;
  maxWaitForFreePage: number;
  maxRetries: number;
  maxAttempts: number;
}

export interface DataConfig {
  resultsFolder: string;
  sourcesFolder: string;
  stepsFolder: string;
  strategiesFolder: string;
  taskPath: string;
  brands: string[];
  scenario?: string;
  imageProcessing: ImageProcessingConfig;
}

export interface BrowserConfig {
  fingerprintFile: string;
  mode: IBrowserMode;
  downloadImages: boolean;
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

export interface ImageProcessingConfig {
  convertToJpg: boolean;
  // картинки меньше указанных здесь размеров скачиваться не будут
  minWidth: number;
  minHeight: number;
}
