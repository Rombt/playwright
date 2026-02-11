export interface IAppConfig {
  async?: {
    retry?: RetryConfig;
  };
  data: {
    resultsFolder: string;
  };
}

export interface RetryConfig {
  baseDelay: number;
  maxDelay: number;
}
