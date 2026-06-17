import { IStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { AppConfig } from '../../../data/config/appConfig';
import { getAbsoluteHref } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';

export default class DefaultSearchResultsStrategy
  implements IStrategy<CheckSearchResultsParams, SearchResult>
{
  name = 'DefaultSearchResultsStrategy';

  // сейчас не использую может в будущих версиях
  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    // базовая стратегия — всегда может работать
    return true;
  }

  // сейчас не использую может в будущих версиях
  async score(): Promise<number> {
    return 10;
  }

  async execute(ctx: IExecutionContext, params: CheckSearchResultsParams): Promise<SearchResult> {
    const { page } = ctx;

    if (!params?.linkSelector) {
      throw new Error('linkSelector is not configured');
    }

    const link = page.locator(params.linkSelector).first();
    const empty = params.emptySelectorText
      ? page
          .locator(params.emptySelector ?? '.view-empty')
          .filter({ hasText: params.emptySelectorText })
      : page.locator(params.emptySelector ?? '.view-empty');

    try {
      const result = await Promise.any([
        link
          // для new_balance нужен именно attached
          .waitFor({ state: 'attached', timeout: ctx.appConfig.asyncRetry.maxDelay })
          .then(() => 'link'),
        empty
          .waitFor({ state: 'visible', timeout: ctx.appConfig.asyncRetry.maxDelay })
          .then(() => 'empty'),
      ]);
    } catch (e) {
      // if (e instanceof AggregateError) {
      //   ctx.logger?.debug('************************', {
      //     component: '',
      //     method: '',
      //     action: '',
      //     data: {
      //       e: e.errors,
      //     },
      //   });
      // }

      throw new Error(`Search result not resolved. ${ctx.input.sku}`);
    }

    if ((await empty.count()) > 0) {
      throw new Error(`Goods not found on the page. ${ctx.input.sku}`);
    }

    return {
      productUrl: await getAbsoluteHref(ctx.page, link),
    };
  }
}
