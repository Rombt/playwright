import { AppConfig } from '../../../data/config/appConfig';

export async function waitBeforeRetry(
  attempt: number,
  baseDelay?: number,
  maxDelay?: number,
): Promise<void> {
  const cfg = AppConfig.getInstance();

  const retryCfg = cfg.asyncRetry?.retry;
  const defaultBase = 100;
  const defaultMax = 5000;

  const delay = Math.min(
    (baseDelay ?? retryCfg?.baseDelay ?? defaultBase) * 2 ** (attempt - 1),
    maxDelay ?? retryCfg?.maxDelay ?? defaultMax,
  );

  return new Promise(resolve => setTimeout(resolve, delay));
}
