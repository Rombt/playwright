"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const App_1 = require("./app/App");
(async () => {
    const app = new App_1.App('browserOptions.json', 'contextOptions.json');
    await app.run();
})();
