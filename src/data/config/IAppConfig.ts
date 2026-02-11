export interface IAppConfig {
  async?: AsyncConfig;
  data: {
    resultsFolder: string;
  };
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
