export interface IAppConfig {
  async?: AsyncConfig;
  data?: DataConfig;
  browser?: BrowserConfig;
}

export interface AsyncConfig {
  retry: RetryConfig;

  tasks: {
    maxTask: number;
  };

  pages: {
    maxPage: number;
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
