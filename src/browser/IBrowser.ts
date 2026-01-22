export interface IBrowser<T> {
  readonly isInitialized: boolean;
  init(): Promise<T>;
  close(): Promise<void>;
}