import { LogStage } from './LogStage';

export interface LogMeta {
  component?: string;
  method?: string;
  action?: string;
  stage?: LogStage;
  contextId?: string;
  data?: unknown;
  [key: string]: unknown;
}
