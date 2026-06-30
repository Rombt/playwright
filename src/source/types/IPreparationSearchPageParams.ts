export type IPreparationSearchPageParams = {
  strategy: string;
  openInputSelector?: string;
  inputSelector?: string;
  selector?: string;
  scrollIntoViewIfNeeded?: boolean;
  useWaitForSystemToCoolDown?: boolean;
  timeoutMs?: number;
  maxDelay?: number;
  minFreeMemMB?: number;
  maxCpuLoad?: number;
};
