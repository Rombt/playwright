import * as fs from 'fs';
import * as path from 'path';
import { config as appConfig } from '../../config';
import { IAppConfig, RetryConfig, AsyncConfig, DataConfig, BrowserConfig } from './IAppConfig';

export class AppConfig {
  private static instance: AppConfig;
  private readonly rawConfig: any;
  private readonly config: IAppConfig;
  private readonly baseDir: string;

  private constructor() {
    this.baseDir = process.cwd();
    this.config = this.buildConfig();
  }

  public static getInstance(): AppConfig {
    if (!this.instance) {
      this.instance = new this();
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

  public get resultsFolder(): string {
    return this.processData(appConfig).data.resultsFolder;
  }

  public get sourcesFolder(): string {
    return this.processData(appConfig).data.sourcesFolder;
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

  public get fingerprintFile(): string {
    return this.processBrowser(appConfig).browser.fingerprintFile;
  }

  // ==========  методы для обработки полей  ===============

  private processData(rawConfig: any): { data: DataConfig } {
    const dataConfig = rawConfig?.data ?? {};

    const resolveBrands = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === 'string')
            .map(v => v.trim())
            .filter(Boolean)
        : [];

    return {
      data: {
        resultsFolder: this.resolvePath(dataConfig.resultsFolder),
        sourcesFolder: this.resolvePath(dataConfig.sourcesFolder),
        brands: resolveBrands(dataConfig.brands),
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
          maxDelay: typeof retry.maxDelay === 'number' ? retry.maxDelay : 5000,
          maxRetries: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
        },
        tasks: {
          maxTask: typeof asyncConfig.tasks?.maxTask === 'number' ? asyncConfig.tasks.maxTask : 5,
        },
        pages: {
          maxPage: typeof asyncConfig.pages?.maxPage === 'number' ? asyncConfig.pages.maxPage : 10,
        },
      },
    };
  }

  processBrowser(rawConfig: any): { browser: BrowserConfig } {
    const browserConfig = rawConfig?.browser ?? {};

    return {
      browser: {
        fingerprintFile: this.resolvePath(browserConfig.fingerprintFile),
      },
    };
  }

  //==========  helpers ========

  resolvePath(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error(`Invalid path value: expected string, got ${typeof value}`);
    }

    return path.isAbsolute(value) ? value : path.resolve(this.baseDir, value);
  }
}
