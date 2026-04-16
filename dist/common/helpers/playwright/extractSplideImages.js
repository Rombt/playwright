"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSplideImages = extractSplideImages;
async function extractSplideImages(page, options) {
    const container = typeof options.container === 'string' ? page.locator(options.container) : options.container;
    // 1. Ждём инициализацию Splide
    await container.locator('.splide__slide').first().waitFor({ timeout: 5000 });
    // 2. "Будим" слайдер (принудительно прогоняем состояние)
    await container.evaluate(async (root) => {
        function sleep(ms) {
            return new Promise((r) => setTimeout(r, ms));
        }
        const track = root.querySelector('.splide__track');
        const slides = Array.from(root.querySelectorAll('.splide__slide'));
        // 1) пробуем через API Splide (если доступен)
        const splideInstance = root?.splide;
        if (splideInstance) {
            try {
                splideInstance.go('>'); // следующий
                await sleep(200);
                splideInstance.go('<'); // назад
            }
            catch { }
        }
        // 2) fallback — имитация прокрутки через transform
        if (track) {
            track.scrollLeft = track.scrollWidth;
            await sleep(200);
            track.scrollLeft = 0;
        }
        // 3) кликаем стрелки (если есть)
        const nextBtn = root.querySelector('.splide__arrow--next');
        if (nextBtn) {
            for (let i = 0; i < 5; i++) {
                nextBtn.click();
                await sleep(200);
            }
        }
        // 4) пробуем активировать все слайды (важно для lazy-load)
        for (const slide of slides) {
            slide.dispatchEvent(new Event('mouseenter', { bubbles: true }));
            slide.dispatchEvent(new Event('mouseover', { bubbles: true }));
        }
    });
    // 3. Извлекаем изображения
    const images = await container.locator('.splide__slide').evaluateAll((slides) => {
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
    // 4. дедупликация
    return Array.from(new Set(images));
}
