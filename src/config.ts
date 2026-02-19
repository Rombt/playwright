export const config = {
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

  logger: {
    level: 'debug',
    transports: [
      { type: 'console' },
      { type: 'file', options: { filePath: './logs/app.log', pretty: true } },
    ],
  },
};
