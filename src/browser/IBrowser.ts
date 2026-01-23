export interface IBrowser<Browser,Context,LaunchOptions=void,BrowserContextOptions=void> {
  readonly isInitialized: boolean;
  init(options?: LaunchOptions): Promise<Browser>;
  close(): Promise<void>;
  runInContext<Result>(
    fn: (context: Context) => Promise<Result>,
    options?: BrowserContextOptions
  ): Promise<Result>;

}


//!!!!  методы для работы с содержимым страницы !!!!!