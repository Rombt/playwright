import { IWorkerError } from '../../../data/entities/IErrors/IWorkerError';

export function isRetryable(workerError: IWorkerError): boolean {
  if (!workerError || !workerError.error) return false;

  const err = workerError.error;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (msg.includes('timeout') || msg.includes('net::')) return true;

    if (msg.includes('element not found') || msg.includes('not visible')) return true;
  }

  return false;
}
