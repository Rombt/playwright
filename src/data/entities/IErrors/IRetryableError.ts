export type RetryStatus = 'retriable' | 'fatal';

export interface IRetryableMeta {
  status: RetryStatus;
  stage: 'collect' | 'download';
}
