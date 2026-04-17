import { IPageResolver } from './IPageResolver';
import { IImageExtractor } from './extractors/IImageExtractor';
import { IDescriptionExtractor } from './extractors/IDescriptionExtractor';

export interface IBasePageSourceConfig {
  resolver: IPageResolver;

  imageExtractor?: IImageExtractor;
  descriptionExtractor?: IDescriptionExtractor;
}
