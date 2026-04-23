import { ITask } from '../data/entities/ITask';
import { ICollectProductPhotosTask } from '../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { ISource } from '../source/types/ISource';
import { IResource } from '../browser/IResource';
import { IProduct } from '../data/entities/IProduct';
import { IWorkerError } from '../data/entities/IErrors/IWorkerError';

export interface IScenario<Browser = unknown, BrowserContext = unknown> {
  registerResource(res: IResource): void;

  /**
   * Точка входа в сценарий.
   * Запускает полный жизненный цикл выполнения.
   * Единственный метод, доступный внешнему коду.
   */
  run(brands?: string[]): Promise<void>;

  /**
   * Загрузка входных данных ().
   * Работает только с Data Layer.
   */
  load(brands?: string[]): Promise<ITask[]>;

  /**
   * Подготовка окружения выполнения.
   * Инициализация технических аспектов.
   */
  prepare(): Promise<void>;

  /**
   * Основной алгоритм выполнения.
   * Перебор задач, выбор Source, управление потоком.
   */
  process(task: ITask): Promise<void>;

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
  loadSources(): Promise<ISource<ICollectProductPhotosTask>[]>;

  // getUnprocessedProducts(errors: IWorkerError[]): IProduct[];
}
