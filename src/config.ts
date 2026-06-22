export const config = {
  async: {
    retry: {
      baseDelay: 2000,
      maxDelay: 30000,
      maxWaitForFreePage: 240000, // т.к. страница из пула освободится через maxDelay
      maxRetries: 3, // количество повторов в одной обработке
      maxAttempts: 5, // количество повторных обработок не обработанных продуктов
    },
    tasks: {
      maxTask: 4,
    },
    pages: {
      maxPage: 5, // for all brands
      // maxPage: 1, // for salomon
      maxPageDownloadImg: 5, // если не задавать то будет равным maxPage если и maxPage не задано то 10
      maxWaiters: 1500,
      pageLoadWait: 10000,
    },
  },

  data: {
    // resultsFolder: 'results/all_brands_test',
    resultsFolder: 'results/bezet/bezet_test',
    // resultsFolder: 'results/kiborg/kiborg_test',
    // resultsFolder: 'results/srm/srm_test',
    // resultsFolder: 'results/jack_wolfskin/jack_wolfskin_test',
    // resultsFolder: 'results/joma/joma_test',
    // resultsFolder: 'results/fenix/fenix_test',
    // resultsFolder: 'results/m-tac/militarist_test_1',
    // resultsFolder: 'results/camotec/camotec_test',
    // resultsFolder: 'results/adidas/adidas_test',
    // resultsFolder: 'results/everlast/everlast_test',
    // resultsFolder: 'results/puma/puma_test',
    // resultsFolder: 'results/under_armour/under_armour_test',
    // resultsFolder: 'results/under_armour/under_armour_prod',
    // resultsFolder: 'results/salomon/salomon_test',
    // resultsFolder: 'results/nike/nike_prod',

    taskPath: 'src/data/tasks/bezet/bezet_test.json',
    // taskPath: 'src/data/tasks/kiborg/kiborg_test.json',
    // taskPath: 'src/data/tasks/srm/srm_test.json',
    // taskPath: 'src/data/tasks/joma/joma_test_short.json',
    // taskPath: 'src/data/tasks/m-tac/militarist_test.json',
    // taskPath: 'src/data/tasks/camotec/camotec_test.json',
    // taskPath: 'src/data/tasks/everlast/everlast_test.json',
    // taskPath: 'src/data/tasks/skechers/skechers.json',
    // taskPath: 'src/data/tasks/svastone/svastone_test.json',
    // taskPath: 'src/data/tasks/salomon/salomon_test_short.json',
    // taskPath: 'src/data/tasks/ganzo/ganzo_test_short.json',
    // taskPath: 'src/data/tasks/nike/nike_prod.json',
    // taskPath: 'src/data/tasks/under_armour/under_armour_test_short.json',
    // src\data\tasks\under_armour\under_armour_test_short.json
    // taskPath: 'src/data/tasks/puma/puma_test.json',
    // taskPath: 'src/data/tasks/puma/puma_test_short.json',
    // taskPath: 'src/data/tasks/all_brands_for_test.json',

    sourcesFolder: './dist/source/sources',
    stepsFolder: './dist/source/steps',
    strategiesFolder: './dist/source/strategies',
    // scenario: 'rozetka',   // для отсутствующих sources
    convertToJpg: true,
  },
  browser: {
    fingerprintFile: './fingerprint.config.json',
    mode: 'fake',
    // downloadImages: false, // если false картинки не будут скачиваться нужно для отладки текстовых процессоров по дефолту true
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
