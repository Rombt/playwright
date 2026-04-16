"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSlickImages = extractSlickImages;
async function extractSlickImages(page, options) {
    const container = typeof options.container === 'string' ? page.locator(options.container) : options.container;
    // 1. Ждём галерею
    await container.locator('.slick-slide').first().waitFor({ timeout: 5000 });
    // 2. "Будим" ТОЛЬКО этот слайдер
    await container.evaluate(async (root) => {
        function sleep(ms) {
            return new Promise((r) => setTimeout(r, ms));
        }
        // ищем track внутри контейнера
        const track = root.querySelector('.slick-track');
        if (track) {
            track.scrollLeft = track.scrollWidth;
            await sleep(300);
            track.scrollLeft = 0;
        }
        // кликаем next внутри контейнера
        const nextBtn = root.querySelector('.slick-next');
        if (nextBtn) {
            for (let i = 0; i < 5; i++) {
                nextBtn.click();
                await sleep(300);
            }
        }
    });
    // 3. Собираем изображения ТОЛЬКО внутри контейнера
    const images = await container.locator('.slick-slide').evaluateAll((slides) => {
        function parseSrcset(srcset) {
            return srcset.split(',').map((item) => {
                const [url, size] = item.trim().split(' ');
                return {
                    url,
                    width: size ? parseInt(size.replace('w', ''), 10) : 0,
                };
            });
        }
        function getBest(srcset) {
            return parseSrcset(srcset).sort((a, b) => b.width - a.width)[0]?.url;
        }
        function toOriginal(url) {
            return url
                .replace(/_w\d+_h\d+/g, '')
                .replace(/-\d+x\d+/g, '')
                .split('?')[0];
        }
        const results = [];
        slides.forEach((slide) => {
            const img = slide.querySelector('img');
            const source = slide.querySelector('source');
            const srcset = source?.getAttribute('srcset') ||
                img?.getAttribute('srcset') ||
                img?.getAttribute('data-srcset');
            const src = img?.getAttribute('src') || img?.getAttribute('data-src');
            let url = srcset ? getBest(srcset) : src || '';
            if (url) {
                results.push(toOriginal(url));
            }
        });
        return results;
    });
    // 4. Убираем дубликаты
    return Array.from(new Set(images));
}
