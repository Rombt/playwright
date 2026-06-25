import { PlaywrightBrowser } from '../browser/playwright/PlaywrightBrowser';
import { FileStorage } from '../storage/fs/FileStorage';

import { DefaultScenario } from './scenarios/DefaultScenario';
// import { RozetkaScenario } from './scenarios/RozetkaScenario';

type ScenarioConstructor = new (
  browser: PlaywrightBrowser,
  storage: FileStorage,
  mode: string,
) => any;

export class ScenarioFactory {
  private static registry: Record<string, ScenarioConstructor> = {
    default: DefaultScenario,
    // rozetka: RozetkaScenario,
  };

  static create(name: string, browser: PlaywrightBrowser, storage: FileStorage, mode: string) {
    const Scenario = this.registry[name] || this.registry.default;
    return new Scenario(browser, storage, mode);
  }
}
