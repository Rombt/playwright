import { IExecutionContext } from './IExecutionContext';

export interface ILightSourceConfig {
  extractImages?: (ctx: IExecutionContext) => Promise<string[]>;
  extractHtml?: (ctx: IExecutionContext) => Promise<string>;
}
