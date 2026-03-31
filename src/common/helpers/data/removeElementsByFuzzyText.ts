import { CheerioAPI } from 'cheerio';
import { Element } from 'domhandler';
import { fuzzy } from 'fast-fuzzy';

export function removeElementsByFuzzyText(
  dom: CheerioAPI,
  targetText: string,
  threshold = 0.8,
): void {
  dom('*').each((_, el) => {
    if (el.type !== 'tag') return;

    const element = el as Element;

    const directText = element.children
      .filter((child) => child.type === 'text')
      .map((child) => (child as any).data as string)
      .join(' ')
      .trim();

    if (!directText) return;

    if (fuzzy(targetText, directText) >= threshold) {
      dom(element).remove();
    }
  });
}
