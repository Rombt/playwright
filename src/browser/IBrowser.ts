import { Page, Browser, BrowserContext } from 'playwright';

export interface IBrowser<
  BrowserT = Browser,
  ContextT = BrowserContext,
  LaunchOptionsT = void,
  ContextOptionsT = void,
> {
  readonly isInitialized: boolean;

  // запуск обычного браузера
  init(options?: LaunchOptionsT): Promise<BrowserT>;

  close(): Promise<void>;

  // обычный контекст
  createContext(mode?: 'real' | 'fake'): Promise<ContextT>;

  runInContext<Result>(
    fn: (context: ContextT) => Promise<Result>,
    mode?: 'real' | 'fake',
  ): Promise<Result>;

  runInContextByChromium<Result>(
    fn: (context: BrowserContext) => Promise<Result>,
    mode?: 'real' | 'fake',
  ): Promise<Result>;

  download(page: Page, url: string): Promise<{ buffer: Buffer; ext: string }>;
}
