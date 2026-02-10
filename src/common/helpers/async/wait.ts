import { appConfig } from '../../../config/appConfig';

export async function waitBeforeRetry(
  attempt: number,
  baseDelay?: number,
  maxDelay?: number,
): Promise<void> {
  const delay = Math.min(
    (baseDelay ?? appConfig.async.retry.baseDelay) * 2 ** (attempt - 1),
    maxDelay ?? appConfig.async.retry.maxDelay,
  );

  return new Promise(resolve => setTimeout(resolve, delay));
}
