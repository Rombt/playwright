export interface IPage {
  // Навигация
  goto(url: string): Promise<void>;

  // Базовые действия
  click(selector: string): Promise<void>;
  dblclick(selector: string): Promise<void>;
  hover(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  check(selector: string): Promise<void>;
  uncheck(selector: string): Promise<void>;
  selectOption(selector: string, value: string): Promise<void>;

  // Ожидания
  waitForSelector(selector: string, timeout?: number): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;

  // Получение данных
  getText(selector: string): Promise<string>;
  getAttribute(selector: string, attr: string): Promise<string | null>;
  isVisible(selector: string): Promise<boolean>;

  // Скролл / страница
  scrollToEnd(): Promise<void>;
  screenshot(options?: { path?: string }): Promise<void>;

  // Низкоуровневое выполнение
  evaluate<T>(fn: () => T): Promise<T>;

  // Клавиатура
  keyboardType(text: string): Promise<void>;
  keyboardPress(key: string): Promise<void>;

  // Viewport
  setViewportSize(width: number, height: number): Promise<void>;

  // Iframe
  frame(selector: string): Promise<IPage>;

  // Жизненный цикл
  close(): Promise<void>;
}
