import { App } from "./app/App";

(async () => {
  const app = new App(
    'browserOptions.json',
    'contextOptions.json',
  );
  await app.run();
})();