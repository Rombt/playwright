"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    async: {
        retry: {
            baseDelay: 1000,
            maxDelay: 30000,
            maxWaitForFreePage: 60000, // страница из пула освободится через maxDelay
            maxRetries: 5,
        },
        tasks: {
            maxTask: 5,
        },
        pages: {
            maxPage: 5,
            maxWaiters: 100,
            pageLoadWait: 10000,
        },
    },
    data: {
        resultsFolder: 'results',
        sourcesFolder: './dist/source/sources',
        brands: ['M-TAC', 'New Balance', 'Saucony', 'Columbia'],
    },
    browser: {
        fingerprintFile: './fingerprint.config.json',
    },
    logger: {
        level: 'debug',
        transports: [
            { type: 'console', options: {} },
            { type: 'file', options: { filePath: './logs/app.log', pretty: true } },
        ],
    },
};
