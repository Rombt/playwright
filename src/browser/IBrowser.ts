export interface IBrowser<
  BrowserT,
  ContextT,
  LaunchOptionsT = void,
  ContextOptionsT = void
> {
  readonly isInitialized: boolean;

  init(options?: LaunchOptionsT): Promise<BrowserT>;

  close(): Promise<void>;

  createContext(options?: ContextOptionsT): Promise<ContextT>;

  runInContext<Result>(
    fn: (context: ContextT) => Promise<Result>
  ): Promise<Result>;
}



//!!!!  методы для работы с содержимым страницы !!!!!