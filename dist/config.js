"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    async: {
        retry: {
            baseDelay: 1000,
            maxDelay: 20000,
            maxRetries: 5,
        },
        tasks: {
            maxTask: 2,
        },
        pages: {
            maxPage: 2,
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
};
