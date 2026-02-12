import { BrowserContextOptions } from 'playwright';

export interface IFingerprintProfile extends BrowserContextOptions {
  userAgent: string;
  viewport: { width: number; height: number };
  colorScheme: 'light' | 'dark';
  locale: string;
  timezoneId: string;
}

export interface IFingerprintPool {
  get(): IFingerprintProfile | null;
  release(profile: IFingerprintProfile): void;
}
