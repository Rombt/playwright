export const config = {
  async: {
    retry: {
      baseDelay: 5000,
      maxDelay: 30000,
      maxWaitForFreePage: 60000, // т.к. страница из пула освободится через maxDelay
      maxRetries: 5,
    },
    tasks: {
      maxTask: 2,
    },
    pages: {
      maxPage: 2,
      maxWaiters: 100,
      pageLoadWait: 10000,
    },
  },
  data: {
    resultsFolder: 'results_avif',
    sourcesFolder: './dist/source/sources',
    convertToJpg: true,
    // brands: ['M-TAC', 'New Balance', 'Saucony', 'Columbia'], // указать те которые должны быть обработаны. Кроме них другие обрабатываться не будут
    // brands: ['Joma'],
    // brands: ['New Balance'],

    // taskPath: 'src/data/tasks/all_brands_for_test.json',
    // taskPath: 'src/data/tasks/puma_for_tests.json',
    // taskPath: 'src/data/tasks/m-tac_for_tests.json',
    // taskPath: 'src/data/tasks/new_balance_tests.json',
    // taskPath: 'src/data/tasks/nike_tests.json',
    // taskPath: 'src/data/tasks/joma_tests.json',
    // taskPath: 'src/data/tasks/adidas_tests.json',
    // taskPath: 'src/data/tasks/ganzo_tests.json',
    taskPath: 'src/data/tasks/puma_dev_tests_1.json',
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
