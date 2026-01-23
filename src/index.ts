import { App } from "./app/App";

(async () => {
  const app = new App('browserOptions.json');
  await app.run();
})();