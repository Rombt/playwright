"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// todo подобрать название по лучше!!
class NikeCollectImagesStrategy {
    name = 'NikeCollectImagesStrategy';
    // сейчас не использую может в будущих версиях
    async canHandle(ctx) {
        // базовая стратегия — всегда может работать
        return true;
    }
    // сейчас не использую может в будущих версиях
    async score() {
        return 10;
    }
    async execute(ctx) {
        const { page } = ctx;
        const absoluteImageUrls = await this.collectNikeImages(page);
        return {
            absoluteImageUrls,
        };
    }
    async collectNikeImages(page) {
        // 1. Собираем все возможные изображения
        const locators = page.locator(`
      [data-testid="HeroImg"],
      [data-testid^="Thumbnail-Img"]
    `);
        const count = await locators.count();
        const rawUrls = [];
        for (let i = 0; i < count; i++) {
            const src = await locators.nth(i).getAttribute('src');
            if (!src)
                continue;
            // 2. фильтр: убираем видео-превью
            if (src.includes('/videos/'))
                continue;
            rawUrls.push(src);
        }
        // 3. убираем дубликаты
        const unique = [...new Set(rawUrls)];
        // 4. нормализуем в максимум качества
        const result = [];
        for (const url of unique) {
            const best = await this.getBestQuality(url);
            if (best)
                result.push(best);
        }
        return result;
    }
    async getBestQuality(url) {
        const candidates = this.buildCandidates(url);
        for (const candidate of candidates) {
            if (await this.urlExists(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    buildCandidates(url) {
        const candidates = [];
        // 1. оригинал (иногда работает)
        candidates.push(url.replace(/\/a\/images\/[^/]+\//, '/a/images/'));
        // 2. максимальные пресеты
        candidates.push(url.replace(/t_[^/]+/, 't_PDP_1440_v1'));
        candidates.push(url.replace(/t_[^/]+/, 't_PDP_1024_v1'));
        // 3. hero как fallback
        candidates.push(url);
        return [...new Set(candidates)];
    }
    async urlExists(url) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
exports.default = NikeCollectImagesStrategy;
