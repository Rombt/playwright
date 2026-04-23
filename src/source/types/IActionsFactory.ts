import { Page } from 'playwright-core';
import { IActions } from './IActions';

export interface IActionsFactory {
  create(page: Page): IActions;
}
