export class RateLimiter {
  private lastRun = 0;

  constructor(private readonly intervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastRun;

    if (delta < this.intervalMs) {
      await new Promise(res => setTimeout(res, this.intervalMs - delta));
    }

    this.lastRun = Date.now();
  }

  async schedule<T>(callback: () => Promise<T>): Promise<T> {
    await this.wait();
    const result = await callback();
    return result;
  }

  /**
   * Асинхронная задержка случайной длины
   * с равномерным распределением в диапазоне [min, max].
   *
   * Используется для добавления пауз между запросами,
   * снижения нагрузки или имитации человеческого поведения.
   *
   * @param min Минимальная задержка в миллисекундах
   * @param max Максимальная задержка в миллисекундах
   * @returns Promise, который резолвится после истечения задержки
   */
  async sleep(min: number, max: number) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async sleepNormal(min: number, max: number) {
    const delay = this.randomNormal(min, max);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Генерирует случайное число в диапазоне [min, max]
   * с приближённым нормальным (Gaussian) распределением.
   *
   * Большинство значений концентрируется вокруг среднего,
   * а крайние значения встречаются реже, что делает задержки
   * более естественными (например, для anti-bot сценариев).
   *
   * Используется преобразование Бокса–Мюллера.
   * Результат жёстко ограничивается границами диапазона.
   *
   * @param min Минимальное значение диапазона
   * @param max Максимальное значение диапазона
   * @returns Случайное число в пределах [min, max]
   */
  randomNormal(min: number, max: number) {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    const mean = (min + max) / 2;
    const std = (max - min) / 6;
    return Math.min(max, Math.max(min, mean + num * std));
  }
}
