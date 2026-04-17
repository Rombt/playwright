import { Page, Locator } from '@playwright/test';
import { IExtractImgOptions } from './types/IExtractImgOptions';

export async function extractSplideImages(
  page: Page,
  options: IExtractImgOptions,
): Promise<string[]> {
  const container: Locator =
    typeof options.container === 'string' ? page.locator(options.container) : options.container;

  // 1. Ждём появления слайдера
  await container.locator('.splide__slide').first().waitFor({ timeout: 5000 });

  // 2. "Прогреваем" все слайды через Splide API
  await container.evaluate(async (root) => {
    function sleep(ms: number) {
      return new Promise((r) => setTimeout(r, ms));
    }

    const splide = (root as any).__splide || (root as any).splide || (root as any)._splide;

    const slides = root.querySelectorAll('.splide__slide:not(.is-clone)');

    if (splide && typeof splide.go === 'function') {
      const total = slides.length;

      for (let i = 0; i < total; i++) {
        try {
          splide.go(i);
          await sleep(250);
        } catch {}
      }
    } else {
      // fallback — кликаем стрелку
      const nextBtn = root.querySelector('.splide__arrow--next') as HTMLElement | null;

      if (nextBtn) {
        for (let i = 0; i < slides.length; i++) {
          nextBtn.click();
          await sleep(250);
        }
      }
    }

    // ждём загрузку всех изображений
    const imgs = Array.from(root.querySelectorAll('img'));

    await Promise.all(
      imgs.map((img) => {
        if ((img as HTMLImageElement).complete) return;

        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }),
    );
  });

  // 3. Извлекаем изображения
  const images = await container.locator('.splide__slide:not(.is-clone)').evaluateAll((slides) => {
    function parseSrcset(srcset: string) {
      return srcset.split(',').map((item) => {
        const [url, size] = item.trim().split(' ');
        return {
          url,
          width: size ? parseInt(size.replace('w', ''), 10) : 0,
        };
      });
    }

    function getBestFromSrcset(srcset: string): string | null {
      const parsed = parseSrcset(srcset);
      if (!parsed.length) return null;

      parsed.sort((a, b) => b.width - a.width);
      return parsed[0].url;
    }

    function extractUrl(el: Element): string | null {
      const attrs = ['src', 'data-src', 'data-lazy', 'data-original', 'data-splide-lazy'];

      for (const attr of attrs) {
        const val = el.getAttribute(attr);
        if (val) return val;
      }

      return null;
    }

    function toOriginal(url: string): string {
      return url
        .replace(/_w\d+_h\d+/g, '')
        .replace(/-\d+x\d+/g, '')
        .split('?')[0];
    }

    const results: string[] = [];

    slides.forEach((slide) => {
      const picture = slide.querySelector('picture');
      const img = slide.querySelector('img');

      let url: string | null = null;

      // 1. сначала srcset (лучшее качество)
      const source = picture?.querySelector('source');
      const srcset =
        source?.getAttribute('srcset') ||
        img?.getAttribute('srcset') ||
        img?.getAttribute('data-srcset');

      if (srcset) {
        url = getBestFromSrcset(srcset);
      }

      // 2. fallback — обычные атрибуты
      if (!url && img) {
        url = extractUrl(img);
      }

      if (url) {
        results.push(toOriginal(url));
      }
    });

    return results;
  });

  const baseUrl = page.url();

  const normalized = images.filter(Boolean).map((url) => toAbsoluteUrl(url, baseUrl));

  // 4. дедупликация
  return Array.from(new Set(normalized));
}

function toAbsoluteUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}
