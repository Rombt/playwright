export interface IBrowser<Browser,Context,LaunchOptions=void,BrowserContextOptions=void> {

  readonly isInitialized: boolean;

  init(options?: LaunchOptions): Promise<Browser>;

  close(): Promise<void>;

  createContext(BrowserContextOptions?: BrowserContextOptions): Promise<Context>;

  runInContext<Result>(
    fn: (context: Context) => Promise<Result>
  ): Promise<Result>;

}


//!!!!  методы для работы с содержимым страницы !!!!!