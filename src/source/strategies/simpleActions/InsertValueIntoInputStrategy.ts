import { IActionStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { getAbsoluteHref, waitForSystemToCoolDown } from '../../../common/helpers';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';
import { IPreparationSearchPageParams } from '../../types/IPreparationSearchPageParams';
import { IActionResult } from '../../types/IActionResult';

export default class InsertValueIntoInputStrategy
  implements IActionStrategy<IPreparationSearchPageParams>
{
  name = 'InsertValueIntoInputStrategy';

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
    if (!params.openInputSelector || !params.inputSelector) {
      throw new Error('Input selectors are not defined in params');
    }

    if (!ctx.input.normalizedSku) {
      throw new Error(
        'InsertValueIntoInputStrategy. SKU or normalizedSku are not defined in context',
      );
    }

    const openInputEl = ctx.page.locator(params.openInputSelector);
    const input = ctx.page.locator(params.inputSelector);

    try {
      /* не срабатывает при запуске через VPN */
      // await ctx.page.waitForLoadState('networkidle');

      /* иногда не срабатывает при запуске через VPN */
      // await ctx.page.waitForFunction(() => {
      //   return document.readyState === 'complete';
      // });

      /* срабатывает при запуске через VPN */
      await ctx.page.waitForLoadState('load');

      if (params.useWaitForSystemToCoolDown) {
        await waitForSystemToCoolDown(ctx, {
          minFreeMemMB: 1000,
          maxCpuLoad: 0.5,
          timeoutMs: params.timeoutMs,
        });
      }

      await ctx.page.waitForTimeout(params.maxDelay || 5000);

      await openInputEl.waitFor({ state: 'visible' });

      if (params.scrollIntoViewIfNeeded) {
        await openInputEl.scrollIntoViewIfNeeded();
      }

      await openInputEl.click();

      await input.waitFor({ state: 'visible' });
      await input.fill(ctx.input.normalizedSku);

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof AggregateError) {
        ctx.logger?.debug('Input element don`t received', {
          component: 'InsertValueIntoInputStrategy',
          method: 'execute()',
          action: 'openInputEl.click()',
          data: {
            e: error.errors,
          },
        });
      }

      return {
        success: false,
        error,
      };
    }
  }
}
