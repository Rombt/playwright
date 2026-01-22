export interface IBrowser<Browser,Context> {
  readonly isInitialized: boolean;
  init(): Promise<Browser>;
  close(): Promise<void>;
  runInContext<Result>(fn: (context: Context) => Promise<Result>): Promise<Result>;

}