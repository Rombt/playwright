export const config = {
  async: {
    retry: {
      baseDelay: 2000,
      maxDelay: 30000,
      maxWaitForFreePage: 240000, // т.к. страница из пула освободится через maxDelay
      maxRetries: 10, // количество повторов в одной обработке
      maxAttempts: 5, // количество повторных обработок не обработанных продуктов
    },
    tasks: {
      maxTask: 4,
    },
    pages: {
      maxPage: 10,
      maxPageDownloadImg: 5, // если не задавать то будет равным maxPage если и maxPage не задано то 10
      maxWaiters: 1500,
      pageLoadWait: 10000,
    },
  },
  data: {
    // resultsFolder: 'results/results_test',
    // resultsFolder: 'results/results_militarist_c_01.09.25_full_prod',
    // resultsFolder: 'results/m-tac/militarist_1000x1000_test',
    // resultsFolder: 'results/m-tac/militarist_1000x1000_c_01.09.25_full_prod',
    // resultsFolder: 'results/m-tac/militarist_all_prod',
    // resultsFolder: 'results/camotec/camotec_test',
    // resultsFolder: 'results/camotec/camotec_all_prod',
    // resultsFolder: 'results/kiborg/kiborg_test',
    // resultsFolder: 'results/bezet/bezet_all_3',
    // resultsFolder: 'results/bezet/bezet_test_short',
    // resultsFolder: 'results/all_brands',
    // resultsFolder: 'results/columbia/columbia_test',
    // resultsFolder: 'results/brs/brs_prod',
    resultsFolder: 'results/brs/brs_prod_2',

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
    // taskPath: 'src/data/tasks/puma_dev_tests_1.json',
    // taskPath: 'src/data/tasks/m-tac/m-tac_for_tests.json',
    // taskPath: 'src/data/tasks/m-tac/m-tac_c_01.09.25_prod.json',
    // taskPath: 'src/data/tasks/m-tac/militarist_for_tests.json',
    // taskPath: 'src/data/tasks/m-tac/militarist_all_prod.json',
    // taskPath: 'src/data/tasks/ganzo/ganzo_tests.json',
    // taskPath: 'src/data/tasks/ganzo/ganzo_c_01.09.25_prod.json',
    // taskPath: 'src/data/tasks/camotec/camotec_tests.json',
    // taskPath: 'src/data/tasks/camotec/camotec_all_prod.json',
    // taskPath: 'src/data/tasks/kiborg/kiborg_tests.json',
    // taskPath: 'src/data/tasks/bezet/bezet_all_prod_3.json',
    // taskPath: 'src/data/tasks/bezet/bezet_test.json',
    // taskPath: 'src/data/tasks/bezet/bezet_test_short.json',
    taskPath: 'src/data/tasks/brs/brs_prod_2.json',
  },
  browser: {
    fingerprintFile: './fingerprint.config.json',
    mode: 'fake',
  },
  //
  logger: {
    // level: 'info',
    level: 'debug',
    // level: 'error',
    transports: [
      { type: 'console', options: {} },
      { type: 'file', options: { filePath: './logs/app.log', pretty: true } },
    ],
  },
};
