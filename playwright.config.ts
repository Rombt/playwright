import { defineConfig } from '@playwright/test';


/**
 * запуск конкретного теста
 *  npx playwright test --project=site_1
 *
 * запуск всех тестов
 *  npx playwright test
 *
 *
 */





export default defineConfig({
  timeout: 30_000,
  reporter: [['html', { open: 'never' }]],

  use: {
    headless: false,
    viewport: { width: 1400, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'columbia.com',
      testDir: 'tests/columbia',
      use: { baseURL: 'https://www.columbia.com/' },
       outputDir: 'test-results/columbia',
    },
    // {
    //   name: 'site_2',
    //   testDir: 'tests/site_2',
    //   use: { baseURL: 'https://site2.com' },
    // },
  ],
});
