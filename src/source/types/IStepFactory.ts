import { IStep } from './IStep';
import { IExecutionContext } from './IExecutionContext';

export interface IStepFactory {
  /**
   * Создать шаг по имени
   */
  create<T extends IStep = IStep>(name: string, ctx?: IExecutionContext): T;

  /**
   * Проверить, зарегистрирован ли шаг
   */
  has(name: string): boolean;

  /**
   * Получить список всех доступных шагов
   */
  getAvailableSteps(): string[];
}
