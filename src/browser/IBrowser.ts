import { Page, Browser, BrowserContext } from 'playwright';
import { ILogger } from '../data/logger/types/ILogger';

export interface IBrowser<
  BrowserT = Browser,
  ContextT = BrowserContext,
  LaunchOptionsT = void,
  ContextOptionsT = void,
> {
  readonly isInitialized: boolean;

  // запуск обычного браузера
  init(options?: LaunchOptionsT): Promise<BrowserT>;

  close(profileDir?: string): Promise<void>;

  // обычный контекст
  createContext(mode?: 'real' | 'fake'): Promise<ContextT>;

  runInContext<Result>(
    fn: (context: ContextT) => Promise<Result>,
    mode?: 'real' | 'fake',
  ): Promise<Result>;

  runInContextByChromium<Result>(
    fn: (context: BrowserContext) => Promise<Result>,
    mode?: 'real' | 'fake',
    loggerScope?: ILogger,
  ): Promise<Result>;

  download(
    page: Page,
    url: string,
    loggerScope?: ILogger,
  ): Promise<{ buffer: Buffer; ext: string }>;

  downloadStaticResource(
    url: string,
    context: BrowserContext,
    loggerScope?: ILogger,
  ): Promise<{ buffer: Buffer; ext: string }>;
}
