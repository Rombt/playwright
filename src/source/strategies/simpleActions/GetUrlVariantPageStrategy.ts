// import { Page } from 'playwright-core';
import { ITransformStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { getAbsoluteHref } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';
import { IPreparationSearchPageParams } from '../../types/IPreparationSearchPageParams';
import { IActionResult } from '../../types/IActionResult';
import { IOpenProductPageParams } from '../../types/IOpenProductPageParams';

export default class GetUrlVariantPageStrategy implements ITransformStrategy<IOpenProductPageParams, string> {
  name = 'GetUrlVariantPageStrategy';

  // сейчас не использую может в будущих версиях
  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    const similar = ctx.page.locator('');
    return (await similar.count()) > 0;
  }

  // сейчас не использую может в будущих версиях
  async score(ctx: IExecutionContext): Promise<number> {
    // менее приоритетная стратегия
    return 50;
  }

  async execute(ctx: IExecutionContext, stepConfig: IOpenProductPageParams): Promise<string> {
    const originalUrl = ctx.state.urlProductPage;
    if (typeof originalUrl !== 'string') {
      throw new Error('urlProductPage is not a string');
    }

    if (!stepConfig.key || stepConfig.value === undefined) {
      throw new Error('Invalid URL params stepConfig');
    }

    let url: URL;

    try {
      url = new URL(originalUrl);
    } catch {
      throw new Error(`Invalid URL: ${originalUrl}`);
    }

    url.searchParams.set(stepConfig.key, stepConfig.value);

    return url.toString();
  }
}
