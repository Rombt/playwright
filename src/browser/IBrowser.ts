import { Page } from 'playwright';

export interface IBrowser<BrowserContext, ContextT, LaunchOptionsT = void, ContextOptionsT = void> {
  readonly isInitialized: boolean;

  init(options?: LaunchOptionsT): Promise<BrowserContext>;

  close(): Promise<void>;

  createContext(options?: ContextOptionsT): Promise<ContextT>;

  runInContext<Result>(fn: (context: ContextT) => Promise<Result>): Promise<Result>;

  download(page: Page, url: string): Promise<{ filename: string; buffer: Buffer }>;
}
