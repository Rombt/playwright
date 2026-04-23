import { Page } from 'playwright';
import { IActionsFactory } from '../types/IActionsFactory';
import { IActions } from '../types/IActions';
import { Actions } from '../actions/Actions';

export class ActionsFactory implements IActionsFactory {
  create(page: Page): IActions {
    return new Actions(page);
  }
}
