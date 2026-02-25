import { ILogger } from './ILogger';

/**
 * Контекстный логгер для одной конкретной задачи (Job / Scenario).
 *
 * Особенности:
 * - immutable contextId
 * - нельзя создавать новый scoped logger из существующего
 */
export interface IScopedLogger extends ILogger {
  /**
   * Создание нового контекста запрещено.
   * Любая попытка вызова должна быть ошибкой.
   */
  withContext(): never;
}
