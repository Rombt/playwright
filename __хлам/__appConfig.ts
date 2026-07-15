import * as path from 'path';
import { config as appConfig } from '../src/config';

import {
  AsyncConfig,
  BrowserConfig,
  DataConfig,
  IAppConfig,
  ImageProcessingConfig,
  LoggerConfig,
  RetryConfig,
} from '../src/data/config/IAppConfig';

import { ConsoleTransport } from '../src/data/logger/transport/ConsoleTransport';
import { FileTransport } from '../src/data/logger/transport/FileTransport';
import { ILogTransport } from '../src/data/logger/types/ILogTransport';
import { IBrowserMode } from '../src/browser/IBrowserMode';

export class AppConfig {
  private static instance: AppConfig;

  private readonly baseDir: string;

  private readonly config: IAppConfig;

  private constructor() {
    this.baseDir = process.cwd();
    this.config = this.buildConfig();
  }

  /**
   * TODO:
   * Добавить возможность передавать путь к файлу конфигурации.
   * По умолчанию использовать:
   * import { config as appConfig } from '../../config';
   */
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

  /**
   * Построение итоговой конфигурации.
   */
  private buildConfig(): IAppConfig {
    return {
      data: this.processData(appConfig),
      async: this.processAsync(appConfig),
      browser: this.processBrowser(appConfig),
      logger: this.processLogger(appConfig),
    };
  }

  // ==========================================================
  // Getters
  // ==========================================================

  /**
   * Получить готовую конфигурацию.
   */
  public get get(): IAppConfig {
    return this.config;
  }

  public get scenario(): string {
    return this.config.data!.scenario ?? 'default';
  }

  public get resultsFolder(): string {
    return this.config.data!.resultsFolder;
  }

  public get sourcesFolder(): string {
    return this.config.data!.sourcesFolder;
  }

  public get stepsFolder(): string {
    return this.config.data!.stepsFolder;
  }

  public get strategiesFolder(): string {
    return this.config.data!.strategiesFolder;
  }

  public get taskPath(): string {
    return this.config.data!.taskPath;
  }

  public get brands(): string[] {
    return this.config.data!.brands;
  }

  public get imageProcessing(): ImageProcessingConfig {
    return this.config.data!.imageProcessing;
  }

  public get convertToJpg(): boolean {
    return this.config.data!.imageProcessing.convertToJpg;
  }

  public get minImageWidth(): number {
    return this.config.data!.imageProcessing.minWidth;
  }

  public get minImageHeight(): number {
    return this.config.data!.imageProcessing.minHeight;
  }

  public get asyncRetry(): RetryConfig {
    return this.config.async!.retry;
  }

  public get asyncTasks(): AsyncConfig['tasks'] {
    return this.config.async!.tasks;
  }

  public get asyncPages(): AsyncConfig['pages'] {
    return this.config.async!.pages;
  }

  public get fingerprintFile(): string {
    return this.config.browser!.fingerprintFile;
  }

  public get browserMode(): IBrowserMode {
    return this.config.browser!.mode;
  }

  public get downloadImages(): boolean {
    return this.config.browser!.downloadImages;
  }

  public get loggerConfig(): LoggerConfig {
    return this.config.logger!;
  }

  public get loggerTransports(): ILogTransport[] {
    const transports: ILogTransport[] = [];

    for (const transport of this.loggerConfig.transports ?? []) {
      const factory = this.transportFactories[transport.type];

      if (factory) {
        transports.push(factory(transport));
      }
    }

    return transports;
  }

  // ==========================================================
  // Processors
  // ==========================================================

  private processData(rawConfig: IAppConfig): DataConfig {
    const dataConfig = rawConfig.data ?? {};

    const imageProcessing = dataConfig.imageProcessing ?? {};

    const resolveBrands = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];

    return {
      resultsFolder: this.resolvePath(dataConfig.resultsFolder ?? 'results'),
      sourcesFolder: this.resolvePath(dataConfig.sourcesFolder ?? 'source/sources'),
      stepsFolder: this.resolvePath(dataConfig.stepsFolder ?? 'source/steps'),
      strategiesFolder: this.resolvePath(dataConfig.strategiesFolder ?? 'source/strategies'),
      taskPath: this.resolvePath(dataConfig.taskPath ?? 'tasks'),
      brands: resolveBrands(dataConfig.brands),
      scenario: typeof dataConfig.scenario === 'string' ? dataConfig.scenario : 'default',

      imageProcessing: {
        convertToJpg: imageProcessing.convertToJpg ?? false,
        minWidth: typeof imageProcessing.minWidth === 'number' ? imageProcessing.minWidth : 400,
        minHeight: typeof imageProcessing.minHeight === 'number' ? imageProcessing.minHeight : 400,
      },
    };
  }

  private processAsync(rawConfig: IAppConfig): AsyncConfig {
    const asyncConfig = rawConfig.async ?? {};
    const retry = asyncConfig.retry ?? {};

    return {
      retry: {
        baseDelay: typeof retry.baseDelay === 'number' ? retry.baseDelay : 100,

        maxDelay: typeof retry.maxDelay === 'number' ? retry.maxDelay : 3000,

        maxWaitForFreePage:
          typeof retry.maxWaitForFreePage === 'number' ? retry.maxWaitForFreePage : 60000,

        maxRetries: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,

        maxAttempts:
          typeof retry.maxAttempts === 'number'
            ? retry.maxAttempts
            : typeof retry.maxRetries === 'number'
            ? retry.maxRetries
            : 3,
      },

      tasks: {
        maxTask: typeof asyncConfig.tasks?.maxTask === 'number' ? asyncConfig.tasks.maxTask : 5,
      },

      pages: {
        maxPage: typeof asyncConfig.pages?.maxPage === 'number' ? asyncConfig.pages.maxPage : 10,

        maxPageDownloadImg:
          typeof asyncConfig.pages?.maxPageDownloadImg === 'number'
            ? asyncConfig.pages.maxPageDownloadImg
            : typeof asyncConfig.pages?.maxPage === 'number'
            ? asyncConfig.pages.maxPage
            : 10,

        maxWaiters:
          typeof asyncConfig.pages?.maxWaiters === 'number' ? asyncConfig.pages.maxWaiters : 50,

        pageLoadWait:
          typeof asyncConfig.pages?.pageLoadWait === 'number'
            ? asyncConfig.pages.pageLoadWait
            : 15000,
      },
    };
  }

  private processBrowser(rawConfig: IAppConfig): BrowserConfig {
    const browserConfig = rawConfig.browser ?? {};

    const fingerprintFile =
      typeof browserConfig.fingerprintFile === 'string'
        ? this.resolvePath(browserConfig.fingerprintFile)
        : this.resolvePath('./fingerprints/fingerprint.config.json');

    let mode: IBrowserMode = 'real';

    if (browserConfig.mode !== undefined) {
      if (browserConfig.mode === 'real' || browserConfig.mode === 'fake') {
        mode = browserConfig.mode;
      } else {
        throw new Error(`Invalid browser.mode: "${browserConfig.mode}". Allowed: real | fake`);
      }
    }

    return {
      fingerprintFile,
      mode,
      downloadImages: browserConfig.downloadImages ?? true,
    };
  }
  private processLogger(rawConfig: IAppConfig): LoggerConfig {
    const loggerConfig = rawConfig.logger ?? {};

    const transports = Array.isArray(loggerConfig.transports)
      ? loggerConfig.transports.map((transport) => ({
          type: transport.type ?? 'console',
          options: transport.options ?? {},
        }))
      : [
          {
            type: 'console',
            options: {},
          },
        ];

    return {
      level: loggerConfig.level ?? 'error',
      transports,
      jsonFormat: loggerConfig.jsonFormat ?? true,
    };
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  private resolvePath(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error(`Invalid path value: expected string, got ${typeof value}`);
    }

    return path.isAbsolute(value) ? value : path.resolve(this.baseDir, value);
  }

  private readonly transportFactories: Record<
    string,
    (config: { options?: Record<string, unknown> }) => ILogTransport
  > = {
    console: (config) => new ConsoleTransport(Boolean(config.options?.pretty)),

    file: (config) =>
      new FileTransport(String(config.options?.filePath ?? ''), Boolean(config.options?.pretty)),
  };

  private validateUserUrl(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    try {
      const url = new URL(value);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }

      return url.toString();
    } catch {
      return null;
    }
  }
}
