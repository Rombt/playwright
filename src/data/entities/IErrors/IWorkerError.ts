import { Product } from '../Product';

export interface IWorkerError {
  error: unknown;     // ОРИГИНАЛЬНАЯ ошибка Playwright
  product?: Product; // Контекст
}