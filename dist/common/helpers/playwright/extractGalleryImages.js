"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGalleryImages = extractGalleryImages;
async function extractGalleryImages(page, options) {
    const container = typeof options.container === 'string' ? page.locator(options.container) : options.container;
    await container.waitFor({ timeout: 5000 });
    // 🔍 тип галереи
    const type = await container.evaluate((root) => {
        if (root.querySelector('.slick-slide'))
            return 'slick';
        if (root.querySelector('.swiper-slide'))
            return 'swiper';
        return 'grid';
    });
    // 🔥 будим
    await container.evaluate(async (root) => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const next = root.querySelector('.slick-next') || root.querySelector('.swiper-button-next');
        if (next instanceof HTMLElement) {
            for (let i = 0; i < 5; i++) {
                next.click();
                await sleep(200);
            }
        }
    });
    let selector = 'img, source';
    if (type === 'slick') {
        selector = '.slick-slide img, .slick-slide source';
    }
    else if (type === 'swiper') {
        selector = '.swiper-slide img, .swiper-slide source';
    }
    const rawImages = await container.locator(selector).evaluateAll((elements) => {
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
            return parseSrcset(srcset).sort((a, b) => b.width - a.width)[0];
        }
        const results = [];
        elements.forEach((el) => {
            let best;
            if (el.tagName === 'IMG') {
                const srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset');
                const src = el.getAttribute('src') || el.getAttribute('data-src');
                best = srcset ? getBest(srcset) : { url: src || '', width: 0 };
            }
            if (el.tagName === 'SOURCE') {
                const srcset = el.getAttribute('srcset');
                if (srcset) {
                    best = getBest(srcset);
                }
            }
            if (best?.url) {
                results.push(best);
            }
        });
        return results;
    });
    // 🔥 УМНЫЙ DEDUPE
    const map = new Map();
    for (const item of rawImages) {
        // 👉 убираем параметры
        let clean = item.url.split('?')[0];
        // 👉 убираем resize
        clean = clean.replace(/_w\d+_h\d+/g, '');
        clean = clean.replace(/-\d+x\d+/g, '');
        // 👉 ключ изображения (главное!)
        const key = clean
            .replace(/\.(webp|jpeg|jpg|png)$/i, '') // убираем расширение
            .toLowerCase();
        const existing = map.get(key);
        // 👉 сохраняем самый большой вариант
        if (!existing || item.width > existing.width) {
            map.set(key, {
                url: clean,
                width: item.width,
            });
        }
    }
    return Array.from(map.values()).map((x) => x.url);
}
