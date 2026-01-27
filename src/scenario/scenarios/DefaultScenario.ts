import { IScenario } from "../IScenario";
import { Source } from "../../source/Source";
import { Storage } from "../../storage/Storage";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";

import { PlaywrightBrowser } from "../../browser/playwright/PlaywrightBrowser";

export class DefaultScenario<T extends ITask, Browser,Context> implements IScenario<T, Browser, Context> {

  private readonly maxRetries = 10;
  private readonly baseDelay = 500;
  private readonly maxDelay = 5000;


  constructor(
    private source: Source<T>,
    private browser: IBrowser<Browser,Context>,
    private storage: Storage
  ) { }


  async run(): Promise<void> {

    console.log("this.browser.runInContext = ", this.browser.runInContext);

    this.browser.runInContext(async ( context ) => {


      try {
        // await page.goto(url);
        // await page.click(".submit");
      } catch (err) {
        await this.handleError(err); // все retries внутри handleError
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
    // 1. Логирование
    console.error(`Error on attempt ${attempt}:`, error);

    // 2. Проверка, можно ли повторить
    if (attempt < this.maxRetries && this.isRetryable(error)) {
      await this.waitBeforeRetry(attempt); // опциональная пауза
      return this.handleError(error, attempt + 1); // повторяем
    }

    // 3. Если retries закончились — выбросить или сохранить состояние
    throw error;
  }

  finalize(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  protected isRetryable(error: unknown): boolean {
    if (!error) return false;

    // 1️⃣ Если это ошибка Playwright с кодом timeout
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      // таймауты и network glitches считаются retryable
      if (msg.includes("timeout") || msg.includes("net::")) return true;

      // иногда полезно повторять ошибки типа "element not found", если страница динамическая
      if (msg.includes("element not found") || msg.includes("not visible")) return true;
    }

    // 2️⃣ Можно добавить свои кастомные классы ошибок
    if ((error as any)?.retryable === true) return true;

    // 3️⃣ Всё остальное — критические ошибки, retry не делаем
    return false;
  }

  protected async waitBeforeRetry(attempt: number): Promise<void> {

  // экспоненциальный рост: baseDelay * 2^(attempt-1)
  const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);

  return new Promise((resolve) => setTimeout(resolve, delay));
}

}