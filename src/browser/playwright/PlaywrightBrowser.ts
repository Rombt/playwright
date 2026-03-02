import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

import { IBrowser as IBrowser } from '../IBrowser';
import {
  chromium,
  Browser as PWBrowser,
  BrowserContext,
  LaunchOptions,
  BrowserContextOptions,
  Download,
  Page,
} from 'playwright';
import { FingerprintPool } from '../fingerprint/FingerprintPool';
import { ILogger } from '../../data/logger/types/ILogger';

export class PlaywrightBrowser
  implements IBrowser<PWBrowser, BrowserContext, LaunchOptions, BrowserContextOptions>
{
  private instance: PWBrowser | null = null;

  constructor(
    private readonly launchOptions: LaunchOptions,
    private readonly browserContextOptions: BrowserContextOptions,
  ) {}

  public get isInitialized(): boolean {
    return this.instance !== null;
  }

  async init(): Promise<PWBrowser> {
    if (this.isInitialized) return this.instance!;
    this.instance = await chromium.launch(this.launchOptions);
    return this.instance;
  }

  async close(profilesDir?: string): Promise<void> {
    if (!this.instance) return;

    try {
      for (const context of this.instance.contexts()) {
        try {
          await context.close();
        } catch (err) {
          console.warn('Error closing context:', err);
        }
      }
    } catch (err) {
      console.warn('Error closing browser:', err);
    } finally {
      await this.instance.close();
      this.instance = null;

      if (profilesDir) {
        await fs.rm(profilesDir, {
          recursive: true,
          force: true,
        });
      }
    }

    console.log('Browser closed.');
  }

  async createContext(mode: 'real' | 'fake' = 'real'): Promise<BrowserContext> {
    const browser = await this.init();

    if (mode === 'fake') {
      const fingerprintPool = new FingerprintPool();
      const fingerprint = fingerprintPool.get();

      if (!fingerprint) {
        throw new Error('Нет доступного fingerprint профиля');
      }

      return browser.newContext({
        ...this.browserContextOptions,
        ...fingerprint,
      });
    }

    return browser.newContext(this.browserContextOptions);
  }

  async runInContext<Result>(
    fn: (context: BrowserContext) => Promise<Result>,
    mode?: 'real' | 'fake',
  ): Promise<Result> {
    const context = await this.createContext(mode);

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    try {
      return await fn(context);
    } finally {
      await context.close();
    }
  }

  async runInContextByChromium<Result>(
    fn: (context: BrowserContext) => Promise<Result>,
    mode?: 'real' | 'fake',
    loggerScope?: ILogger,
  ): Promise<Result> {
    loggerScope?.debug('The enter to the runInContextByChromium', {
      component: 'PlaywrightBrowser',
      method: 'runInContextByChromium',
      stage: 'init',
      data: {},
    });

    const baseDir = path.resolve('./browser-profiles/chrome-profiles');
    await fs.mkdir(baseDir, { recursive: true });
    const profileDir = path.join(baseDir, `chrome-profile-${crypto.randomUUID()}`);

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled'],
    });

    loggerScope?.debug('Context is received', {
      component: 'PlaywrightBrowser',
      method: 'runInContextByChromium',
      stage: 'init',
      data: {
        context: context,
      },
    });

    try {
      return await fn(context);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      loggerScope?.error('Problems with browser context', {
        component: 'PlaywrightBrowser',
        method: 'runInContextByChromium',
        action: 'return await fn(context);',
        data: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
      throw error;
    } finally {
      await context.close();
      await fs.rm(profileDir, {
        recursive: true,
        force: true,
      });
    }
  }

  async download(
    page: Page,
    url: string,
    loggerScope?: ILogger,
  ): Promise<{ buffer: Buffer; ext: string }> {
    let downloadEvent: Download | undefined;
    let buffer: Buffer = Buffer.from([]);
    let ext: string = '';

    if (!page) {
      loggerScope?.error(`Page is undefined; browser context has been closed`, {
        component: 'PlaywrightBrowser',
        method: 'download(...)',
        action: 'page.waitForEvent(...)',
        data: {
          url: url,
        },
      });
      throw new Error('Page is undefined; browser context has been closed');
    }

    loggerScope?.debug(`Entering PlaywrightBrowser.download()`, {
      component: 'PlaywrightBrowser',
      method: 'download()',
      action: 'start',
      data: {
        url: url,
        page: page,
      },
    });

    const downloadPromise = page
      .waitForEvent('download')
      .then((d: Download) => {
        loggerScope?.debug(`Trying to download a file from url`, {
          component: 'PlaywrightBrowser',
          method: 'page.waitForEvent(...)',
          data: {
            url: url,
            d: d,
          },
        });

        downloadEvent = d;
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));

        loggerScope?.error(`Image file download failed`, {
          component: 'PlaywrightBrowser',
          method: 'download(...)',
          action: 'page.waitForEvent(...)',
          data: {
            url: url,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
        throw new Error('Image file download failed');
      });

    const response = await page.goto(url);
    await downloadPromise;

    if (downloadEvent) {
      loggerScope?.debug(`File download succeeded`, {
        component: 'PlaywrightBrowser',
        method: 'download()',
        action: 'if (downloadEvent)',
        data: {
          downloadEvent: downloadEvent,
        },
      });

      const suggestedFilename = downloadEvent.suggestedFilename();
      const ext = path.extname(suggestedFilename) || '.jpg';

      const stream = await downloadEvent.createReadStream();
      if (!stream) {
        loggerScope?.error(`Failed to create read stream for downloaded file`, {
          component: 'PlaywrightBrowser',
          method: 'download(...)',
          action: 'page.waitForEvent(...)',
          data: {
            stream: stream,
          },
        });

        throw new Error('Failed to create read stream for downloaded file');
      }

      loggerScope?.debug(`File read stream created successfully.`, {
        component: 'PlaywrightBrowser',
        method: 'download(...)',
        action: 'page.waitForEvent(...)',
        data: {
          stream: stream,
        },
      });

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }

      return {
        buffer: Buffer.concat(chunks),
        ext: ext,
      };
    }

    if (!response) {
      loggerScope?.error(`Failed to navigate to URL`, {
        component: 'PlaywrightBrowser',
        method: 'download(...)',
        action: 'page.goto(url)',
        data: {
          url: url,
        },
      });

      throw new Error('Failed to navigate to URL');
    }

    try {
      buffer = await response.body();
      const contentType = response.headers()['content-type'] || '';

      if (!buffer || !contentType) {
        //todo Обработка ситуации: пропустить, повторить, или выбросить ошибку
        loggerScope?.error(`Response body or content-type is empty for URL`, {
          component: 'PlaywrightBrowser',
          method: 'download(...)',
          action: 'buffer = await response.body()',
          data: {
            url: url,
            buffer: buffer,
            contentType: contentType,
          },
        });
        throw new Error('Response body or content-type is empty for URL');
      } else {
        if (contentType.includes('image/jpeg')) ext = '.jpg';
        else if (contentType.includes('image/png')) ext = '.png';
        else if (contentType.includes('image/webp')) ext = '.webp';
        else if (contentType.includes('image/avif')) ext = '.avif';
        else if (contentType.includes('application/pdf')) ext = '.pdf';

        loggerScope?.debug(`Response body read successfully for URL`, {
          component: 'PlaywrightBrowser',
          method: 'download(...)',
          action: 'buffer = await response.body()',
          data: {
            url: url,
            ext: ext,
          },
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      loggerScope?.error(`Failed to read response body or headers from URL`, {
        component: 'PlaywrightBrowser',
        method: 'download(...)',
        action: 'buffer = await response.body()',
        data: {
          url: url,
          ext: ext,
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      throw new Error('Failed to read response body or headers from URL');
    }

    return { buffer, ext };
  }

  async downloadStaticResource(
    url: string,
    context: BrowserContext,
    loggerScope?: ILogger,
  ): Promise<{ buffer: Buffer; ext: string }> {
    loggerScope?.debug(`Entering PlaywrightBrowser.downloadStaticResource()`, {
      component: 'PlaywrightBrowser',
      method: 'downloadStaticResource()',
      action: 'start',
      data: { url },
    });

    let response;

    try {
      response = await context.request.get(url, {
        timeout: 30000,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      loggerScope?.error(`HTTP request failed`, {
        component: 'PlaywrightBrowser',
        method: 'downloadStaticResource()',
        action: 'request.get',
        data: {
          url,
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack,
        },
      });

      throw error;
    }

    if (!response || !response.ok()) {
      loggerScope?.error(`HTTP response not OK`, {
        component: 'PlaywrightBrowser',
        method: 'downloadStaticResource()',
        action: 'response validation',
        data: {
          url,
          status: response?.status(),
        },
      });

      throw new Error(`HTTP ${response?.status()} while fetching resource`);
    }

    let buffer: Buffer;
    let ext = '';

    try {
      buffer = await response.body();
      const contentType = response.headers()['content-type'] ?? '';

      if (!buffer || !contentType) {
        throw new Error('Empty body or missing content-type');
      }

      if (contentType.includes('image/jpeg')) ext = '.jpg';
      else if (contentType.includes('image/png')) ext = '.png';
      else if (contentType.includes('image/webp')) ext = '.webp';
      else if (contentType.includes('image/avif')) ext = '.avif';
      else if (contentType.includes('application/pdf')) ext = '.pdf';
      else ext = '';

      loggerScope?.debug(`Static resource downloaded successfully`, {
        component: 'PlaywrightBrowser',
        method: 'downloadStaticResource()',
        action: 'success',
        data: {
          url,
          ext,
          contentType,
          size: buffer.length,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      loggerScope?.error(`Failed to read response body`, {
        component: 'PlaywrightBrowser',
        method: 'downloadStaticResource()',
        action: 'response.body()',
        data: {
          url,
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack,
        },
      });

      throw error;
    }

    return { buffer, ext };
  }
}
