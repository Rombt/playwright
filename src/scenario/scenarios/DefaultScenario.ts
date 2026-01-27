import { IScenario } from "../IScenario";
import { Source } from "../../source/Source";
import { Storage } from "../../storage/Storage";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";


import { BrowserContext } from "playwright";

import { PlaywrightPageAdapter as PageAdapter } from "../../browser/playwright/PlaywrightPageAdapter";

export class DefaultScenario<
  T extends ITask,
  Browser,
  Context extends BrowserContext
> implements IScenario<T, Browser, Context> {

  private readonly maxRetries = 10;
  private readonly baseDelay = 500;
  private readonly maxDelay = 5000;


  constructor(
    private source: Source<T>,
    private browser: IBrowser<Browser,Context>,
    private storage: Storage
  ) { }


  async run(): Promise<void> {

    this.browser.runInContext(async (context) => {

      const page = await PageAdapter.create(context);

      try {

        await page.goto('https://google.com');

      } catch (err) {
        await this.handleError(err);
      }



    })



  }

  load(): Promise<T[]> {
    throw new Error("Method not implemented.");
  }
  prepare(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  process(tasks: T[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async handleError(error: unknown, attempt: number = 1): Promise<void> {

    console.error(`Error on attempt ${attempt}:`, error);

    if (attempt < this.maxRetries && this.isRetryable(error)) {
      await this.waitBeforeRetry(attempt);
      return this.handleError(error, attempt + 1);
    }

    throw error;
  }

  finalize(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  protected isRetryable(error: unknown): boolean {
    if (!error) return false;

    // Если это ошибка Playwright с кодом timeout
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      // таймауты и network glitches
      if (msg.includes("timeout") || msg.includes("net::")) return true;

      // если страница динамическая
      if (msg.includes("element not found") || msg.includes("not visible")) return true;
    }

    if ((error as any)?.retryable === true) return true;

    return false;
  }

  protected async waitBeforeRetry(attempt: number): Promise<void> {

  // экспоненциальный рост: baseDelay * 2^(attempt-1)
  const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);

  return new Promise((resolve) => setTimeout(resolve, delay));
}

}