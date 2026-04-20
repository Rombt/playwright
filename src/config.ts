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
      maxPage: 10, // for all brands
      // maxPage: 1, // for salomon
      maxPageDownloadImg: 5, // если не задавать то будет равным maxPage если и maxPage не задано то 10
      maxWaiters: 1500,
      pageLoadWait: 10000,
    },
  },

  data: {
    // resultsFolder: 'results/skechers',
    // resultsFolder: 'results/salomon/salomon_test',
    // resultsFolder: 'results/svastone/svastone_test',
    resultsFolder: 'results/brs/brs_test_1',

    // sourcesFolder: './dist/source/sources',
    sourcesFolder: './dist/source/sources_s',
    // scenario: 'rozetka',   // для отсутствующих sources
    convertToJpg: true,
    // taskPath: 'src/data/tasks/skechers/skechers.json',
    // taskPath: 'src/data/tasks/svastone/svastone_test.json',
    // taskPath: 'src/data/tasks/salomon/salomon_test_short.json',
    // taskPath: 'src/data/tasks/svastone/svastone_test_short.json',
    taskPath: 'src/data/tasks/brs/brs_test_short.json',
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
