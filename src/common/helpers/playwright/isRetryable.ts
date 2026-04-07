import { IWorkerError } from '../../../data/entities/IErrors/IWorkerError';
import { RetryStatus } from '../../../data/entities/IErrors/IRetryableError';

const RETRYABLE_ERRORS = ['timeout', 'net::', 'network', '503', 'socket', 'econnreset'];

export function getRetryStatus(workerError: IWorkerError): RetryStatus {
  if (!workerError || !workerError.error) return 'fatal';

  const msg =
    workerError.error instanceof Error
      ? workerError.error.message.toLowerCase()
      : String(workerError.error).toLowerCase();

  const isRetry = RETRYABLE_ERRORS.some((e) => msg.includes(e));

  return isRetry ? 'retriable' : 'fatal';
}
