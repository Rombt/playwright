import { IStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { getAbsoluteHref } from '../../../common/helpers';

type CheckSearchResultsParams = {
  sku: string;
};

type SearchResult = {
  productUrl: string;
};

type StrategyConfig = {
  similarSelector: string;
  itemLinkSelector: string;
};

export default class SimilarProductsSearchStrategy
  implements IStrategy<CheckSearchResultsParams, SearchResult>
{
  name = 'SimilarProductsSearchStrategy';

  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    const similar = ctx.page.locator('.similar-products');
    return (await similar.count()) > 0;
  }

  async score(ctx: IExecutionContext): Promise<number> {
    // менее приоритетная стратегия
    return 50;
  }

  async execute(ctx: IExecutionContext, params: CheckSearchResultsParams): Promise<SearchResult> {
    const similar = ctx.page.locator('.similar-products');
    const items = similar.locator('.product-card');

    const count = await items.count();

    if (!count) {
      throw new Error(`No similar products found. ${params.sku}`);
    }

    const firstItemLink = items.first().locator('a');

    return {
      productUrl: await getAbsoluteHref(ctx.page, firstItemLink),
    };
  }
}
