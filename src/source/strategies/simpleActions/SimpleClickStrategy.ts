import { IActionStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { getAbsoluteHref } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';
import { IPreparationSearchPageParams } from "../../types/IPreparationSearchPageParams";
import { IActionResult } from '../../types/IActionResult';

export default class SimpleClickStrategy implements IActionStrategy<IPreparationSearchPageParams> {
  name = 'SimpleClickStrategy';

  // сейчас не использую может в будущих версиях
  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    const similar = ctx.page.locator('.similar-products');
    return (await similar.count()) > 0;
  }

  // сейчас не использую может в будущих версиях
  async score(ctx: IExecutionContext): Promise<number> {
    // менее приоритетная стратегия
    return 50;
  }

  async execute(
    ctx: IExecutionContext,
    params: IPreparationSearchPageParams,
  ): Promise<IActionResult> {
    try {
      const el = ctx.page.locator(params.selector);

      await el.waitFor({ state: 'visible' });
      await el.click();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error,
      };
    }
  }
}
