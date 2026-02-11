export interface IAppConfig {
  async?: {
    retry?: {
      baseDelay: number;
      maxDelay: number;
    };
  };
  data: {
    resultsFolder: string;
  };
}
