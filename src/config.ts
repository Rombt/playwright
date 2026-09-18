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
      // pageLoadWait: 10000,
      pageLoadWait: 120000, // так много потому что у некоторых сайтов очень тяжёлые картинки например как здесь https://sportowestyleb2b.pl/pl/search.html?text={{sku_prod}}
    },
  },

  data: {
    // resultsFolder: 'results/4f/14.09.26',
    // resultsFolder: 'results/all_brands_test',
    resultsFolder: 'results/alpine_crown/18.09.26',
    // resultsFolder: 'results/avecs/avecs_test_1',
    // resultsFolder: 'results/avecs/avecs_prod_13.08.26',
    // resultsFolder: 'results/kappa/kappa_test',
    // resultsFolder: 'results/alpine_crown/alpine_crown_test',
    // resultsFolder: 'results/emporio_armani/emporio_armani_prod',
    // resultsFolder: 'results/belement/belement_test',
    // resultsFolder: 'results/columbia/columbia_test',
    // resultsFolder: 'results/bezet/bezet_12.08.26',
    // resultsFolder: 'results/kiborg/kiborg_test',
    // resultsFolder: 'results/srm/srm_test',
    // resultsFolder: 'results/jack_wolfskin/jack_wolfskin_test',
    // resultsFolder: 'results/joma/joma_test',
    // resultsFolder: 'results/fenix/fenix_test',
    // resultsFolder: 'results/m-tac/militarist_12.08.26',
    // resultsFolder: 'results/adidas/adidas_prod_13.08.26',
    // resultsFolder: 'results/everlast/everlast_test',
    // resultsFolder: 'results/puma/puma_test',
    // resultsFolder: 'results/under_armour/under_armour_test',
    // resultsFolder: 'results/under_armour/under_armour_prod_10.08.26_1',
    // resultsFolder: 'results/salomon/salomon_test',
    // resultsFolder: 'results/nike/nike_prod',

    taskPath: 'src/data/tasks/alpine_crown/alpine_crown_test.json',
    // taskPath: 'src/data/tasks/alpine_crown/alpine_crown_test_short.json',
    // taskPath: 'src/data/tasks/lasting/lasting_test_1.json',
    // taskPath: 'src/data/tasks/lasting/lasting_test.json',
    // taskPath: 'src/data/tasks/avecs/avecs_test.json',
    // taskPath: 'src/data/tasks/4f/4f_3.json',
    // taskPath: 'src/data/tasks/avecs/avecs_prod.json',
    // taskPath: 'src/data/tasks/adidas/adidas_prod.json',
    // taskPath: 'src/data/tasks/adidas/adidas_test_short.json',
    // taskPath: 'src/data/tasks/emporio_armani/emporio_armani_test.json',
    // taskPath: 'src/data/tasks/belement/belement_test.json',
    // taskPath: 'src/data/tasks/columbia/columbia_test.json',
    // taskPath: 'src/data/tasks/kappa/kappa_prod.json',
    // taskPath: 'src/data/tasks/kiborg/kiborg_test.json',
    // taskPath: 'src/data/tasks/srm/srm_test.json',
    // taskPath: 'src/data/tasks/joma/joma_test.json',
    // taskPath: 'src/data/tasks/m-tac/m-tac_prod.json',
    // taskPath: 'src/data/tasks/camotec/camotec_test.json',
    // taskPath: 'src/data/tasks/everlast/everlast_test.json',
    // taskPath: 'src/data/tasks/skechers/skechers.json',
    // taskPath: 'src/data/tasks/svastone/svastone_test.json',
    // taskPath: 'src/data/tasks/salomon/salomon_test_short.json',
    // taskPath: 'src/data/tasks/ganzo/ganzo_test_short.json',
    // taskPath: 'src/data/tasks/nike/nike_prod.json',
    // taskPath: 'src/data/tasks/under_armour/under_armour_prod.json',
    // src\data\tasks\under_armour\under_armour_test_short.json
    // taskPath: 'src/data/tasks/puma/puma_test.json',
    // taskPath: 'src/data/tasks/puma/puma_test_short.json',
    // taskPath: 'src/data/tasks/all_brands_for_test.json',

    sourcesFolder: './dist/source/sources',
    stepsFolder: './dist/source/steps',
    strategiesFolder: './dist/source/strategies',
    // scenario: 'rozetka',   // для отсутствующих sources
    imageProcessing: {
      convertToJpg: true,
    },
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
