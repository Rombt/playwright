import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';
import { IHttpResult, IAutocompleteResponse } from '../../data/entities/IResults/IHttpResult';
import { ILogger } from '../../data/logger/types/ILogger';
import { Logger } from '../../data/logger/Logger';

export default class PageImageSourceRozetka implements ISource<ICollectProductPhotosTask> {
  private readonly logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  supports(task: ICollectProductPhotosTask): boolean {
    return task.type === 'recollect-product-photos';
  }

  async workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
    debugMeta: Record<string, string>,
  ): Promise<IHttpResult<IAutocompleteResponse>[]> {
    const results: IHttpResult<IAutocompleteResponse>[] = [];

    let indexForDebug = 0;

    while (true) {
      indexForDebug++;
      const product = getNext();
      if (!product) {
        this.logger.error(`While loop started. The product is absent`, {
          component: 'PageImageSourceRozetka',
          method: 'workerHttpRequest',
          indexForDebug: indexForDebug,
          product: product,
        });
        break;
      }

      const loggerScope = this.logger.withContext(
        `workerHttpRequest   ${debugMeta.brand_name}   ${product.sku}`,
      );

      const rawSku = product.sku;
      const starIndex = rawSku.indexOf('*');
      const sku =
        (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
          /^[\p{C}\s]+|[\p{C}\s]+$/gu,
          '',
        ) ?? '';

      const options = {
        url: targetUrl,
        params: {
          country: 'UA',
          lang: 'ua',
          text: sku,
        },
        headers: headers,
        loggerScope: loggerScope,
      };

      loggerScope.debug(`While loop started successfully.`, {
        component: 'PageImageSourceRozetka',
        method: 'workerHttpRequest',
        indexForDebug: indexForDebug,
        rawSku: rawSku,
        sku: sku,
        options: options,
      });

      await limiter.wait();

      const requestResult = await this.executeHttpRequest<IAutocompleteResponse>(request, options);
      results.push(requestResult);
    }

    return results;
  }

  async executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      loggerScope?: ILogger;
    },
  ): Promise<IHttpResult<T>> {
    const limiter = new RateLimiter(5000);

    try {
      const response = await request.get(options.url, {
        params: options.params,
        headers: options.headers,
      });

      const status = response.status();

      const blockingStatuses = [401, 403, 405, 407, 429, 451, 503];

      if (blockingStatuses.includes(status)) {
        options.loggerScope?.error(`[Blocking Detected]`, {
          component: 'PageImageSourceRozetka',
          method: 'executeHttpRequest',
          responseUrl: response.url(),
        });

        switch (status) {
          case 429: // Rate Limit
            options.loggerScope?.error(`Лимит запросов. Увеличиваем паузу...`, {
              component: 'PageImageSourceRozetka',
              method: 'executeHttpRequest',
              status: status,
            });

            await limiter.sleep(5000, 10000);
            break;
          case 403: // Forbidden / Anti-bot
          case 451: // Geo-Block
            options.loggerScope?.error(
              `Обнаружена блокировка доступа. Требуется смена прокси/сессии.`,
              {
                component: 'PageImageSourceRozetka',
                method: 'executeHttpRequest',
                status: status,
              },
            );
            //todo логика смены прокси: await proxyManager.rotate();
            await limiter.sleep(2000, 5000);
            break;
          case 401: // Unauthorized
            options.loggerScope?.error(`Сессия истекла. Перезапуск авторизации...`, {
              component: 'PageImageSourceRozetka',
              method: 'executeHttpRequest',
              status: status,
            });

            //todo Вызов функции логина
            break;
          case 503: // WAF Challenge (Cloudflare и др.)
            options.loggerScope?.error(`Сервер временно недоступен или проверяет браузер.`, {
              component: 'PageImageSourceRozetka',
              method: 'executeHttpRequest',
              status: status,
            });

            await limiter.sleep(10000, 15000);
            break;
          default:
            options.loggerScope?.error(`Нестандартный статус блокировки`, {
              component: 'PageImageSourceRozetka',
              method: 'executeHttpRequest',
              status: status,
            });

            await limiter.sleep(1000, 3000);
        }
      }

      let body: T | null = null;

      try {
        body = await response.json();

        options.loggerScope?.debug(`The "response.json()" succeeded`, {
          component: 'PageImageSourceRozetka',
          method: 'workerHttpRequest',
          body: body,
        });
      } catch (error) {
        // Если не JSON, пробуем получить текст для диагностики блокировки
        const rawText = await response.text().catch(() => 'Не удалось прочитать body');
        const contentType = response.headers()['content-type'] || 'unknown';

        options.loggerScope?.error(`[Payload Error] Ожидался JSON, получен некорректный формат`, {
          component: 'PageImageSourceRozetka',
          method: 'executeHttpRequest',
          status: status,
          ContentType: contentType,
          RawBody_200_symbol: rawText.substring(0, 200).trim(),
        });

        // Логика принятия решения на основе текста
        if (rawText.includes('cloudflare') || rawText.includes('captcha')) {
          options.loggerScope?.error(`!!! Обнаружен экран проверки (WAF/Challenge) !!!`, {
            component: 'PageImageSourceRozetka',
            method: 'executeHttpRequest',
          });
        }
      }

      return {
        ok: status >= 200 && status < 300,
        status,
        body,
        headers: response.headers(),
        url: options.url,
      };
    } catch (error) {
      options.loggerScope?.error(`The "response.json()" is failed`, {
        component: 'PageImageSourceRozetka',
        method: 'executeHttpRequest',
        error: error,
      });

      return {
        ok: false,
        status: 0,
        body: null,
        error,
        headers: {},
        url: options.url,
      };
    }
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
    sku: string,
  ): Promise<IWorkerResult[]> {
    const results = [];

    // while (true) {
    // if (!targetUrl) break;
    await limiter.wait();
    results.push(await this.execute(targetUrl, page, undefined, sku));
    // }

    return results;
  }

  async execute(url: string, page: Page, product?: IProduct, sku?: string): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const data: IDataImag = {};

    try {
      console.log('===>>>   Пробую url = ', url);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator('.container');

      try {
        await gallery.first().waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error(`No gallery found on page: ${error}`);
      }

      const imageUrls: string[] = await gallery
        .locator('img')
        .evaluateAll((imgs) =>
          imgs
            .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
            .map((img) => img.src),
        );

      console.log('======>>>   imageUrls = ', imageUrls);

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');
      if (!sku) throw new Error('SKU is required');

      data[sku] = imageUrls;
    } catch (err) {
      console.log('======>>>   err = ', err);
      errors.push({
        error: err,
        product: product,
        url: url,
      } as IWorkerError);
    }

    return { data, errors };
  }
}
