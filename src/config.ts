export const config = {
  async: {
    retry: {
      baseDelay: 100,
      maxDelay: 5000,
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
