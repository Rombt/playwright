export const config = {
  async: {
    retry: {
      baseDelay: 2000,
      maxDelay: 20000,
      maxWaitForFreePage: 240000, // т.к. страница из пула освободится через maxDelay
      maxRetries: 10,
    },
    tasks: {
      maxTask: 4,
    },
    pages: {
      maxPage: 10,
      maxWaiters: 1500,
      pageLoadWait: 10000,
    },
  },
  data: {
    // resultsFolder: 'results/results_test',
    // resultsFolder: 'results/results_militarist_c_01.09.25_full_prod',
    resultsFolder: 'results/results_m-tac_c_01.09.25_full_prod',
    sourcesFolder: './dist/source/sources',
    convertToJpg: true,
    // brands: ['M-TAC', 'New Balance', 'Saucony', 'Columbia'], // указать те которые должны быть обработаны. Кроме них другие обрабатываться не будут
    // brands: ['Joma'],
    // brands: ['New Balance'],

    // taskPath: 'src/data/tasks/all_brands_for_test.json',
    // taskPath: 'src/data/tasks/puma_for_tests.json',
    // taskPath: 'src/data/tasks/new_balance_tests.json',
    // taskPath: 'src/data/tasks/nike_tests.json',
    // taskPath: 'src/data/tasks/joma_tests.json',
    // taskPath: 'src/data/tasks/adidas_tests.json',
    // taskPath: 'src/data/tasks/ganzo_tests.json',
    // taskPath: 'src/data/tasks/puma_dev_tests_1.json',
    // taskPath: 'src/data/tasks/m-tac_for_tests.json',
    taskPath: 'src/data/tasks/m-tac_c_01.09.25_prod.json',
  },
  browser: {
    fingerprintFile: './fingerprint.config.json',
  },

  logger: {
    level: 'info',
    transports: [
      { type: 'console', options: {} },
      { type: 'file', options: { filePath: './logs/app.log', pretty: true } },
    ],
  },
};
