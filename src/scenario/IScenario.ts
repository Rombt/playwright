import { ITask } from "../Task/ITask";
import { ISource } from "../source/ISource";

export interface IScenario<
    T extends ITask = ITask,
    Browser = unknown,
    BrowserContext = unknown,
  > {

  /**
   * Точка входа в сценарий.
   * Запускает полный жизненный цикл выполнения.
   * Единственный метод, доступный внешнему коду.
   */
  run(): Promise<void>;

  /**
   * Загрузка входных данных (Job, Task и пр.).
   * Работает только с Data Layer.
   */
  load(): Promise<T[]>;

  /**
   * Подготовка окружения выполнения.
   * Инициализация технических аспектов.
   */
  prepare(): Promise<void>;

  /**
   * Основной алгоритм выполнения.
   * Перебор задач, выбор Source, управление потоком.
   */
  process(tasks: T[]): Promise<void>;

  /**
   * Централизованная обработка ошибок сценария.
   */
  handleError(error: unknown): Promise<void>;

  /**
   * Финализация сценария.
   * Cleanup, финальное логирование, завершение.
   */
  finalize(): Promise<void>;

  /**
   * Загружает все доступные Source.
   * Возвращает массив объектов, реализующих ISource.
   */
  loadSources(): Promise<ISource<T>[]>;
}
