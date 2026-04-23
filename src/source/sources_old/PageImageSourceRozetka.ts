import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../types/ISourceOld';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';
import { IHttpResult, IAutocompleteResponse } from '../../data/entities/IResults/IHttpResult';
import { ILogger } from '../../data/logger/types/ILogger';
import { Logger } from '../../data/logger/Logger';
import { AppConfig } from '../../data/config/appConfig';

export default class PageImageSourceRozetka implements ISource<ICollectProductPhotosTask> {
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor() {
    this.config = AppConfig.getInstance();
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
    sku: string,
    debugMeta: Record<string, string>,
    loggerScope?: ILogger,
  ): Promise<IHttpResult<IAutocompleteResponse>> {
    if (!sku) {
      this.logger.error(`sku is absent`, {
        component: 'PageImageSourceRozetka',
        method: 'workerHttpRequest',
        stage: 'start',
        data: {
          sku: sku,
        },
      });
      throw new Error(`In workerHttpRequest method sku is absent`);
    }

    const options = {
      url: targetUrl,
      sku: sku,
      params: {
        country: 'UA',
        lang: 'ua',
        text: sku,
      },
      headers: headers,
      loggerScope: loggerScope,
    };

    const requestResult = await this.executeHttpRequest<IAutocompleteResponse>(request, options);

    // loggerScope.debug(`Success.`, {
    //   component: 'PageImageSourceRozetka',
    //   method: 'workerHttpRequest',
    //   stage: 'start',
    //   data: {
    //     sku: sku,
    //     options: options,
    //   },
    // });

    return requestResult;
  }

  async executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      sku: string;
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
          action: 'request.get(...)',
          stage: 'finish',
          data: {
            responseUrl: response.url(),
          },
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
          action: 'response.json()',
          stage: 'finish',
          data: {
            sku: options.sku,
            body: body,
          },
        });
      } catch (error) {
        // Если не JSON, пробуем получить текст для диагностики блокировки
        const rawText = await response.text().catch(() => 'Не удалось прочитать body');
        const contentType = response.headers()['content-type'] || 'unknown';

        options.loggerScope?.error(`[Payload Error] Expected JSON, received invalid format`, {
          component: 'PageImageSourceRozetka',
          method: 'executeHttpRequest',
          action: 'response.json()',
          stage: 'finish',
          status: status,
          data: {
            ContentType: contentType,
            RawBody_200_symbol: rawText.substring(0, 200).trim(),
          },
        });

        // Логика принятия решения на основе текста
        if (rawText.includes('cloudflare') || rawText.includes('captcha')) {
          options.loggerScope?.error(`!!! Verification screen (WAF/Challenge) detected !!!`, {
            component: 'PageImageSourceRozetka',
            method: 'executeHttpRequest',
          });
          throw new Error('!!! Verification screen (WAF/Challenge) detected !!!');
        }
        throw new Error('Expected JSON, received invalid format');
      }

      return {
        ok: status >= 200 && status < 300,
        status,
        body,
        headers: response.headers(),
        url: options.url,
      };
    } catch (error) {
      options.loggerScope?.error(`Is failed`, {
        component: 'PageImageSourceRozetka',
        method: 'executeHttpRequest',
        action: 'response.json()',
        stage: 'finish',
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
    product: IProduct,
    logger?: ILogger,
    sku?: string,
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult[]> {
    const results = [];

    const loggerScope = this.logger.withContext(
      `worker ${debugMeta?.brand_name ?? 'no-brand'} ${sku ?? 'no-sku'}`,
    );

    if (!targetUrl) {
      loggerScope?.error(`Received invalid targetUrl`, {
        component: 'PageImageSourceRozetka',
        method: 'worker',
        action: 'if (!targetUrl)',
        data: {
          targetUrl: targetUrl,
        },
      });

      throw new Error('Received invalid targetUrl');
    }

    loggerScope?.debug(`targetUrl is received`, {
      component: 'PageImageSourceRozetka',
      method: 'worker',
      data: {
        targetUrl: targetUrl,
      },
    });

    const options = {
      product: product,
      loggerScope: loggerScope,
    };

    await limiter.wait();
    results.push(await this.execute(targetUrl, page, options));

    loggerScope?.debug(`async worker() is finished ********************`, {
      component: 'PageImageSourceRozetka',
      method: 'worker',
      data: {
        results: results,
      },
    });

    return results;
  }

  async execute(
    url: string,
    page: Page,
    options: { product: IProduct; loggerScope: ILogger },
  ): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const images: IDataImag = {};
    let html: string = '';

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      options.loggerScope?.debug(`Navigated to page`, {
        component: 'PageImageSourceRozetka',
        method: 'worker',
        action: 'page.goto(...)',
        data: {
          url: url,
        },
      });

      const selector = '.container';
      const gallery = page.locator(selector);

      try {
        await gallery
          .first()
          .waitFor({ state: 'attached', timeout: this.config.asyncPages.pageLoadWait });
        options.loggerScope?.debug('Gallery found on page', {
          component: 'PageImageSourceRozetka',
          method: 'worker',
          action: 'gallery.first().waitFor(...)',
          data: { selector: selector },
        });
      } catch (error) {
        options.loggerScope?.error('No gallery found on page', {
          component: 'PageImageSourceRozetka',
          method: 'worker',
          action: 'gallery.waitFor',
          stage: 'wait',
          data: {
            selector: selector,
            timeout: this.config.asyncPages.pageLoadWait,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
        throw new Error(`No gallery found on page: ${error}`);
      }

      let imageUrls: string[] = [];
      const selector_img = 'img';
      try {
        imageUrls = await gallery
          .locator(selector_img)
          .evaluateAll((imgs) =>
            imgs
              .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
              .map((img) => img.src),
          );

        options.loggerScope?.debug('Extracted image URLs', {
          component: 'PageImageSourceRozetka',
          method: 'worker',
          action: `gallery.locator(...).evaluateAll`,
          stage: 'finish',
          data: {
            selector: selector_img,
            imagesFound: imageUrls.length,
            imageUrls: imageUrls,
          },
        });
      } catch (err) {
        options.loggerScope?.error('Failed to extract image URLs from gallery', {
          component: 'PageImageSourceRozetka',
          method: 'worker',
          action: `gallery.locator(...).evaluateAll`,
          stage: 'finish',
          data: {
            selector: selector_img,
            errorName: err instanceof Error ? err.name : undefined,
            errorMessage: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
        });

        throw new Error(`Failed to extract image URLs: ${err}`);
      }

      if (imageUrls.length === 0) {
        options.loggerScope?.warn('No images found in gallery', {
          component: 'PageImageSourceRozetka',
          method: 'worker',
          action: 'gallery.locator(selector_img).evaluateAll',
          stage: 'no_images',
          data: { selector: selector_img },
        });
      }

      if (!options.product.sku) throw new Error('SKU is required');
      images[options.product.sku] = imageUrls as IDataImagItem;
      images[options.product.sku].idProduct = options.product.id_product;
    } catch (err) {
      options.loggerScope?.error('Failed to navigate to page', {
        component: 'PageImageSourceRozetka',
        method: 'worker',
        action: 'page.goto(...)',
        stage: 'navigation_error',
        data: {
          url: url,
          errorName: err instanceof Error ? err.name : undefined,
          errorMessage: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
      });

      errors.push({
        error: err,
        url: url,
      } as IWorkerError);
    }

    return {
      data: {
        images,
        html,
      },
      errors,
    };
  }
}
