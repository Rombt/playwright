import { IProduct } from '../IProduct';

export interface IWorkerError {
  error: unknown; // ОРИГИНАЛЬНАЯ ошибка Playwright
  product?: IProduct; // Контекст
  targetUrl?: string;
}
