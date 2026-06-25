import { IStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { AppConfig } from '../../../data/config/appConfig';
import { getAbsoluteHref } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';
import { fuzzyMatchStrings } from '../../../common/helpers';

export default class FuzzyProductNameSearchResultsStrategy
  implements IStrategy<CheckSearchResultsParams, SearchResult>
{
  name = 'FuzzyProductNameSearchResultsStrategy';

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

    if (!ctx.input.product?.name_product) {
      throw new Error(`Product name is missing for SKU: ${ctx.input.sku ?? 'unknown'}`);
    }
    
    const cleanProdName = ctx.input.product?.name_product?.replace(ctx.input.sku ?? '', '').trim();
    const link = page.locator(params.linkSelector).first();

    if ((await link.count()) == 0) {
      throw new Error(`The link selector not found on the page. ${ctx.input.sku}`);
    }

    const linkText = await link.innerText();
    const productMatch = fuzzyMatchStrings({
      a: cleanProdName,
      b: linkText,
      threshold: 0.4555,
    });

    if (!productMatch.match) {
      throw new Error(`Goods not found on the page. ${ctx.input.sku}`);
    }

    return {
      productUrl: await getAbsoluteHref(ctx.page, link),
    };
  }
}
