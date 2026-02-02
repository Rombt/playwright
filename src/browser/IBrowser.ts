export interface IBrowser<
  BrowserContext,
  ContextT,
  DownloadedFile,
  LaunchOptionsT = void,
  ContextOptionsT = void,
> {
  readonly isInitialized: boolean;

  init(options?: LaunchOptionsT): Promise<BrowserContext>;

  close(): Promise<void>;

  createContext(options?: ContextOptionsT): Promise<ContextT>;

  runInContext<Result>(fn: (context: ContextT) => Promise<Result>): Promise<Result>;

  download(context: ContextT, url: string): Promise<DownloadedFile>;
}
