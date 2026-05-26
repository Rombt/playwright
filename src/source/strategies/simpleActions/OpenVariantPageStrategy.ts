import { Page } from 'playwright-core';
import { IActionStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { getAbsoluteHref } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';
import { IPreparationSearchPageParams } from '../../types/IPreparationSearchPageParams';
import { IActionResult } from '../../types/IActionResult';
import { IOpenVariantPageParam } from '../../types/IOpenVariantPageParam';

export default class OpenVariantPageStrategy
  implements IActionStrategy<IOpenVariantPageParam, Page>
{
  name = 'OpenVariantPageStrategy';

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

  async execute(ctx: IExecutionContext, params: IOpenVariantPageParam): Promise<Page> {
    const Page = ctx.page;

    ctx.logger?.debug('***class OpenVariantPageStrategy', {
      component: '',
      method: 'execute()',
      action: '',
      data: {
        ctx: ctx,
      },
    });;

    return Page;
  }
}
