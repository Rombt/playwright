// npx playwright test tests/columbia/download_image.test.js



const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');


  // ===== Настройки =====
  const url = 'https://www.columbia.com/search?q=2079181&searchMethod=manualSearch';
  const downloadDir = path.resolve(__dirname, '../../test-results/columbia/img');


test('download all images from gallery', async ({ browser }) => {


  // создаём папку, если её нет
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url);

  // находим первую картинку для перехода
  const image = page.locator('#app-main img').first();
  await expect(image).toBeVisible();
  await image.click();

  // ждём загрузки страницы с галереей
  // await page.waitForLoadState('networkidle');

  // находим галерею
  const gallery = page.locator('[data-component-id="image-gallery"]');
  await gallery.waitFor({ state: 'attached', timeout: 15000 });

  const firstImg = gallery.locator('img').first();
  await firstImg.waitFor({ state: 'visible', timeout: 15000 });

  // получаем src всех img
  const  imageUrls = await gallery.locator('img').evaluateAll(imgs =>
    imgs.map(img => img.src)
  );

  console.log('Found images:',  imageUrls);


  for (const url of imageUrls) {
    const tempPage = await context.newPage();
    await tempPage.goto(url);
    const [download] = await Promise.all([
      tempPage.waitForEvent('download'),
      tempPage.evaluate((url) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, url)
    ]);
    await download.saveAs(path.join(downloadDir, await download.suggestedFilename()));
    await tempPage.close();
    await page.waitForTimeout(500);
  }



  await context.close();
});


// async function downloadImage(page, url, index) {
//   const [ download ] = await Promise.all([
//     page.waitForEvent('download'),
//     page.evaluate((url) => {
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = '';
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//     }, url)
//   ]);

//   await download.saveAs(`${downloadDir}/image-${index}.jpg`);
// }