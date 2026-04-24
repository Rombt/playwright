import * as fs from 'fs';
import * as path from 'path';
import { config as appConfig } from '../../config';
import {
  IAppConfig,
  RetryConfig,
  AsyncConfig,
  DataConfig,
  BrowserConfig,
  LoggerConfig,
} from './IAppConfig';
import { ILoggerConfig } from '../logger/types/ILoggerConfig';
import { ILogTransport } from '../logger/types/ILogTransport';
import { ConsoleTransport } from '../logger/transport/ConsoleTransport';
import { FileTransport } from '../logger/transport/FileTransport';
import { IBrowserMode } from '../../browser/IBrowserMode';

export class AppConfig {
  private static instance: AppConfig;
  private readonly rawConfig: any;
  private readonly config: IAppConfig;
  private readonly baseDir: string;

  private constructor() {
    this.baseDir = process.cwd();
    this.config = this.buildConfig();
  }

  //todo добавить путь к файлу конфига при инициализации и оставить import { config as appConfig } from '../../config'; по дефолту
  public static init(): AppConfig {
    if (!this.instance) {
      this.instance = new AppConfig();
    }
    return this.instance;
  }

  public static getInstance(): AppConfig {
    if (!this.instance) {
      throw new Error('AppConfig is not initialized. Call init() first.');
    }
    return this.instance;
  }

  /** Применение processors и нормализация */
  private buildConfig(): IAppConfig {
    let result: IAppConfig = {} as IAppConfig;

    const processors = [
      this.processData.bind(this),
      this.processAsync.bind(this),
      // сюда добавлять методы для обработки новых полей
    ];

    for (const processor of processors) {
      const partial = processor(appConfig);
      result = this.merge(result, partial);
    }

    return result;
  }

  /** Простой merge для частичных результатов processors */
  private merge(target: IAppConfig, source: Partial<IAppConfig>): IAppConfig {
    return {
      ...target,
      ...source,
      ...(source.data ? { data: { ...target.data, ...source.data } } : {}),
    };
  }

  // ========= геттеры =========================

  /** Получить готовый конфиг */
  public get get(): IAppConfig {
    return this.config;
  }

  public get scenario(): string {
    return this.processData(appConfig).data.scenario ?? 'default';
  }

  public get resultsFolder(): string {
    return this.processData(appConfig).data.resultsFolder;
  }

  public get sourcesFolder(): string {
    return this.processData(appConfig).data.sourcesFolder;
  }

  public get stepsFolder(): string {
    return this.processData(appConfig).data.stepsFolder;
  }

  public get taskPath(): string {
    return this.processData(appConfig).data.taskPath;
  }

  public get convertToJpg(): boolean {
    return this.processData(appConfig).data.convertToJpg;
  }

  public get brands(): string[] {
    return this.processData(appConfig).data.brands;
  }

  public get asyncRetry(): RetryConfig {
    return this.processAsync(appConfig).async.retry;
  }

  public get asyncTasks(): AsyncConfig['tasks'] {
    return this.processAsync(appConfig).async.tasks;
  }

  public get asyncPages(): AsyncConfig['pages'] {
    return this.processAsync(appConfig).async.pages;
  }

  public get fingerprintFile(): string | undefined {
    return this.processBrowser(appConfig).browser.fingerprintFile;
  }

  public get browserMode(): IBrowserMode {
    return this.processBrowser(appConfig).browser.mode;
  }
  public get downloadImages(): boolean {
    return this.processBrowser(appConfig).browser.downloadImages;
  }

  public get loggerConfig(): LoggerConfig {
    return this.processLogger(appConfig).logger;
  }

  public get loggerTransports(): ILogTransport[] {
    const transports: ILogTransport[] = [];
    const config = this.loggerConfig;

    for (const t of config.transports ?? []) {
      const factory = this.transportFactories[t.type];

      if (factory) {
        transports.push(factory(t));
      }
    }

    return transports;
  }

  // ==========  методы для обработки полей  ===============

  private processData(rawConfig: any): { data: DataConfig } {
    const dataConfig = rawConfig?.data ?? {};

    const resolveBrands = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];

    return {
      data: {
        resultsFolder: this.resolvePath(dataConfig.resultsFolder ?? 'results'),
        sourcesFolder: this.resolvePath(dataConfig.sourcesFolder ?? 'source/sources'),
        stepsFolder: this.resolvePath(dataConfig.stepsFolder ?? 'source/steps'),
        convertToJpg: dataConfig.convertToJpg ?? false,
        brands: resolveBrands(dataConfig.brands),
        taskPath: this.resolvePath(dataConfig.taskPath),
        scenario: typeof dataConfig.scenario === 'string' ? dataConfig.scenario : 'default',
      },
    };
  }

  processAsync(rawConfig: any): { async: AsyncConfig } {
    const asyncConfig = rawConfig?.async ?? {};

    const retry = asyncConfig.retry ?? {};

    return {
      async: {
        retry: {
          baseDelay: typeof retry.baseDelay === 'number' ? retry.baseDelay : 100,
          maxDelay: typeof retry.maxDelay === 'number' ? retry.maxDelay : 3000,
          maxWaitForFreePage:
            typeof retry.maxWaitForFreePage === 'number' ? retry.maxWaitForFreePage : 60000,
          maxRetries: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
          maxAttempts: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
        },
        tasks: {
          maxTask: typeof asyncConfig.tasks?.maxTask === 'number' ? asyncConfig.tasks.maxTask : 5,
        },
        pages: {
          maxPage: typeof asyncConfig.pages?.maxPage === 'number' ? asyncConfig.pages.maxPage : 10,
          maxPageDownloadImg:
            asyncConfig.pages?.maxPageDownloadImg ?? asyncConfig.pages?.maxPage ?? 10,
          maxWaiters:
            typeof asyncConfig.pages?.maxWaiters === 'number' ? asyncConfig.pages.maxWaiters : 50,
          pageLoadWait:
            typeof asyncConfig.pages?.pageLoadWait === 'number'
              ? asyncConfig.pages.pageLoadWait
              : 15000,
        },
      },
    };
  }

  processBrowser(rawConfig: any): { browser: BrowserConfig } {
    const browserConfig = rawConfig?.browser ?? {};

    // --- fingerprintFile ---
    const fingerprintFile = browserConfig.fingerprintFile
      ? this.resolvePath(browserConfig.fingerprintFile)
      : this.resolvePath('./fingerprints/fingerprint.config.json');

    // --- mode ---
    let mode: IBrowserMode = 'real';

    if (browserConfig.mode !== undefined) {
      if (browserConfig.mode === 'real' || browserConfig.mode === 'fake') {
        mode = browserConfig.mode;
      } else {
        throw new Error(`Invalid browser.mode: "${browserConfig.mode}". Allowed: real | fake`);
      }
    }

    // --- downloadImages ---
    const downloadImages = browserConfig.downloadImages ?? true;

    return {
      browser: {
        fingerprintFile,
        mode,
        downloadImages,
      },
    };
  }

  private processLogger(rawConfig: any): { logger: LoggerConfig } {
    const loggerConfig = rawConfig?.logger ?? {};

    const transports = Array.isArray(loggerConfig.transports)
      ? loggerConfig.transports.map((t: any) => ({
          type: typeof t.type === 'string' ? t.type : 'console',
          options: t.options ?? {},
        }))
      : [{ type: 'console', options: {} }]; // дефолтный transport

    return {
      logger: {
        level: typeof loggerConfig.level === 'string' ? loggerConfig.level : 'error',
        transports,
        jsonFormat: loggerConfig.jsonFormat !== false,
      },
    };
  }

  //==========  helpers ========

  private resolvePath(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error(`Invalid path value: expected string, got ${typeof value}`);
    }

    return path.isAbsolute(value) ? value : path.resolve(this.baseDir, value);
  }

  private transportFactories: Record<string, (config?: any) => ILogTransport> = {
    console: (config: { options: { pretty: boolean } }) =>
      new ConsoleTransport(config.options.pretty),
    file: (config: { options: { filePath: string; pretty: boolean } }) => {
      return new FileTransport(config.options.filePath, config.options.pretty);
    },
  };

  private validateUserUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    try {
      const url = new URL(value);

      if (!['http:', 'https:'].includes(url.protocol)) {
        return null;
      }

      return url.toString();
    } catch {
      return null;
    }
  }
}
