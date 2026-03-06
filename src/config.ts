export const config = {
  async: {
    retry: {
      baseDelay: 1000,
      maxDelay: 30000,
      maxWaitForFreePage: 60000, // страница из пула освободится через maxDelay
      maxRetries: 5,
    },
    tasks: {
      maxTask: 2,
    },
    pages: {
      maxPage: 5,
      maxWaiters: 100,
      pageLoadWait: 10000,
    },
  },
  data: {
    resultsFolder: 'results',
    sourcesFolder: './dist/source/sources',
    /** формирования структур saveDir и saveName используются поля из ICollectProductPhotosTask.ts */
    saveDirPattern: '${task.brand_name}', // структура(!) именования директории для каждой задачи. Пустая строка - в корень resultsFolder
    saveNamePattern: '${item.id_product}', // структура(!) именования файла изображения. Пустая строка - имя файла будет таким как пришло из источника без изменений
    // brands: ['M-TAC', 'New Balance', 'Saucony', 'Columbia'], // указать те которые должны быть обработаны. Кроме них другие обрабатываться не будут
    // brands: ['Joma'],
    brands: ['New Balance'],
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
