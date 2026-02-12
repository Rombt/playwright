import { Page } from 'playwright';

export interface IBrowser<BrowserContext, ContextT, LaunchOptionsT = void, ContextOptionsT = void> {
  readonly isInitialized: boolean;

  init(options?: LaunchOptionsT): Promise<BrowserContext>;

  close(): Promise<void>;

  createContext(mode?: 'real' | 'fake'): Promise<ContextT>;

  runInContext<Result>(
    fn: (context: ContextT) => Promise<Result>,
    mode?: 'real' | 'fake',
  ): Promise<Result>;

  download(page: Page, url: string): Promise<{ buffer: Buffer; ext: string }>;
}
