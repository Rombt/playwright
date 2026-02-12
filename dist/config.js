"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    async: {
        retry: {
            baseDelay: 100,
            maxDelay: 5000,
            maxRetries: 5,
        },
        tasks: {
            maxTask: 5,
        },
        pages: {
            maxPage: 10,
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
