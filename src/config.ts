export const config = {
  async: {
    retry: {
      baseDelay: 2000,
      maxDelay: 30000,
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
    // resultsFolder: 'results/m-tac/militarist_1000x1000_test',
    // resultsFolder: 'results/m-tac/militarist_1000x1000_c_01.09.25_full_prod',
    // resultsFolder: 'results/m-tac/militarist_1000x1000_c_01.09.25_full_prod_2',
    // resultsFolder: 'results/camotec/camotec_test',
    // resultsFolder: 'results/camotec/camotec_c_01.09.25_по_30.03.26_1000x1000_full_prod_2',
    // resultsFolder: 'results/camotec/camotec_c_01.09.25_по_30.03.26_1000x1000_full_prod_3',
    // resultsFolder: 'results/camotec/camotec_c_01.09.25_по_30.03.26_1000x1000_full_prod_4',
    // resultsFolder: 'results/camotec/camotec_c_01.09.25_по_30.03.26_1000x1000_full_prod_5',
    // resultsFolder: 'results/camotec/camotec_c_01.09.25_по_30.03.26_1000x1000_full_prod_6',
    // resultsFolder: 'results/kiborg/kiborg_test',
    resultsFolder: 'results/bezet/bezet_all_3',

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
    // taskPath: 'src/data/tasks/m-tac/militarist_c_01.09.25_prod_2.json',
    // taskPath: 'src/data/tasks/ganzo/ganzo_tests.json',
    // taskPath: 'src/data/tasks/ganzo/ganzo_c_01.09.25_prod.json',
    // taskPath: 'src/data/tasks/camotec/camotec_tests.json',
    // taskPath: 'src/data/tasks/camotec/camotec_c_01.09.25_prod_2.json',
    // taskPath: 'src/data/tasks/camotec/camotec_c_01.09.25_prod_3.json',
    // taskPath: 'src/data/tasks/camotec/camotec_c_01.09.25_prod_4.json',
    // taskPath: 'src/data/tasks/camotec/camotec_c_01.09.25_prod_5.json',
    // taskPath: 'src/data/tasks/camotec/camotec_c_01.09.25_prod_6.json',
    // taskPath: 'src/data/tasks/kiborg/kiborg_tests.json',
    taskPath: 'src/data/tasks/bezet/bezet_all_prod_3.json',
    // taskPath: 'src/data/tasks/bezet/bezet_test.json',
    // taskPath: 'src/data/tasks/bezet/bezet_test_short.json',
  },
  browser: {
    fingerprintFile: './fingerprint.config.json',
  },
  //
  logger: {
    // level: 'info',
    level: 'error',
    transports: [
      { type: 'console', options: {} },
      { type: 'file', options: { filePath: './logs/app.log', pretty: true } },
    ],
  },
};
