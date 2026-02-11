import * as fs from 'fs';
import * as path from 'path';
import { IAppConfig, RetryConfig, AsyncConfig } from './IAppConfig';

export class AppConfig {
  private static instance: AppConfig;
  private readonly rawConfig: any;
  private readonly config: IAppConfig;
  private readonly baseDir: string;

  private constructor(configPath = 'config.json') {
    this.baseDir = process.cwd();
    const absolutePath = path.resolve(process.cwd(), configPath);
    this.rawConfig = this.loadConfigFile(absolutePath);
    this.config = this.buildConfig();
  }

  public static getInstance(): AppConfig {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  private loadConfigFile(filePath: string): any {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /** Применение processors и нормализация */
  private buildConfig(): IAppConfig {
    let result: IAppConfig = {} as IAppConfig;

    const processors = [
      this.processResultsFolder.bind(this),
      this.processAsyncRetry.bind(this),
      // сюда добавлять методы для обработки новых полей
    ];

    for (const processor of processors) {
      const partial = processor(this.rawConfig);
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
    return this.processResultsFolder(this.rawConfig).data?.resultsFolder ?? '';
  }

  public get asyncRetry(): RetryConfig {
    return this.processAsyncRetry(this.rawConfig).async.retry;
  }

  // ==========  методы для обработки полей  ===============

  processResultsFolder(rawConfig: any): { data: { resultsFolder: string } } {
    const rawPath = rawConfig?.data?.resultsFolder;
    const resolved =
      rawPath && typeof rawPath === 'string'
        ? path.isAbsolute(rawPath)
          ? rawPath
          : path.resolve(this.baseDir, rawPath)
        : '';

    return { data: { resultsFolder: resolved } };
  }

  processAsyncRetry(rawConfig: any): { async: AsyncConfig } {
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
}
