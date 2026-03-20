import { Site } from './Site';
import { IBaseHtmlProcessor } from './IBaseHtmlProcessor';

export interface IHtmlProcessorFactory {
  create(site: Site): IBaseHtmlProcessor;
}
