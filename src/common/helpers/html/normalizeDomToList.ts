import { load, CheerioAPI } from 'cheerio';
import { Element } from 'domhandler';

/**
 * normalizeDomToList
 * -------------------
 * Функция нормализации уже очищенного DOM (Cheerio) в стандартизированный список <ul><li>.
 *
 *   Назначение:
 * Преобразует структурированный DOM (полученный через load(html) + sanitizeDom($))
 * в единый нормализованный список, пригодный для дальнейшей обработки:
 * импорт в CMS, генерация контента, SEO, маппинг в DTO и т.д.
 *
 *   ВАЖНО:
 * Функция НЕ работает с raw HTML и НЕ вызывает load().
 * Ожидает уже подготовленный CheerioAPI после sanitizeDom($).
 *
 *   Входные данные:
 * @param $ - CheerioAPI (DOM после load(html) + sanitizeDom($))
 * @param options - объект настроек:
 *   - containers?: string[]
 *       Селекторы внутри DOM, ограничивающие область извлечения.
 *       Если не указаны — используется весь <body>.
 *
 *   - removeSelectors?: string[]
 *       Дополнительные селекторы для удаления элементов внутри контейнеров
 *       перед извлечением данных (поверх sanitizeDom).
 *
 *   - separator?: string
 *       Разделитель между элементами итогового списка (по умолчанию '\n').
 *
 *   Алгоритм работы:
 *
 * 1. Использует уже готовый DOM (CheerioAPI)
 *    - без повторного парсинга HTML
 *    - без load()
 *
 * 2. Определяет контейнеры для обработки:
 *    - если переданы containers → использует их
 *    - иначе → берёт весь <body>
 *
 * 3. Для каждого контейнера извлекает данные по приоритету структуры:
 *    1) <li> — если контент уже структурирован как список
 *    2) <p> — если контент представлен параграфами
 *    3) <br> — если используется разметка через переносы строк
 *    4) fallback — весь текст контейнера
 *
 * 4. Дополнительно очищает контент:
 *    - применяет removeSelectors (локально)
 *    - нормализует текст (trim, collapse whitespace)
 *    - удаляет служебные символы (например •)
 *
 * 5. Дедуплицирует результат
 *
 * 6. Формирует итоговый HTML:
 *    <ul>
 *      <li>...</li>
 *      <li>...</li>
 *    </ul>
 *
 *   Выход:
 * @returns string — HTML-строка списка (<ul><li>...</li></ul>)
 *
 *   Пример использования:
 *
 * const html = await extractRawHtml(page, {
 *   containers: ['.product-description'],
 * });
 *
 * const $ = load(html);
 * sanitizeDom($);
 *
 * const list = normalizeDomToList($, {
 *   containers: ['.features', '.specs'],
 *   removeSelectors: ['.ads', '.hidden'],
 * });
 *
 *   Важные замечания:
 *
 * - Функция работает только с уже очищенным DOM (после sanitizeDom)
 * - Используется эвристический подход (li → p → br → text)
 * - Не существует универсального алгоритма для всех HTML-структур
 * - Порядок извлечения критически важен для качества результата
 * - Повторный parse HTML внутри функции намеренно исключён для производительности
 *
 *   Возможные улучшения:
 *
 * - Добавление режимов:
 *   - strict (только <li>)
 *   - auto (текущий режим)
 *   - text (полный текст без структуры)
 *
 * - Поддержка дополнительных структур:
 *   - table → list
 *   - grid / card layout → list
 *
 * - Введение стратегий извлечения (strategy pattern)
 * - Расширение в полноценный DOM processing pipeline stage
 */
export interface NormalizeHtmlOptions {
  containers?: string[];
  removeSelectors?: string[];
  separator?: string;
}

export function normalizeDomToList($: CheerioAPI, options: NormalizeHtmlOptions = {}): string {
  const { containers = [], removeSelectors = [], separator = '\n' } = options;

  const roots = resolveContainers($, containers);

  const items: string[] = [];

  for (const root of roots) {
    const extracted = extractListItems($, root, removeSelectors);
    items.push(...extracted);
  }

  return buildUl(items, separator);
}

/**
 * Определяем контейнеры внутри HTML
 */
function resolveContainers($: CheerioAPI, selectors: string[]) {
  if (!selectors.length) {
    return [$('body')];
  }

  const result: any[] = [];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      result.push($(el));
    });
  }

  return result;
}

/**
 * Базовая очистка DOM
 */
function sanitizeDom($: CheerioAPI) {
  const remove = [
    'script',
    'style',
    'svg',
    'img',
    'picture',
    'video',
    'iframe',
    'noscript',
    // '[aria-hidden="true"]',
    // '[hidden]',
  ];

  remove.forEach((sel) => $(sel).remove());

  $('*').each((_, el) => {
    if (el.type !== 'tag') return;

    const element = el as Element;

    for (const attr in element.attribs) {
      if (attr === 'style' || attr === 'class' || attr.startsWith('data-')) {
        $(element).removeAttr(attr);
      }
    }
  });
}

/**
 * Извлечение элементов списка из контейнера
 */
function extractListItems($: CheerioAPI, root: any, removeSelectors: string[]): string[] {
  const clone = root.clone();

  removeSelectors.forEach((sel) => {
    clone.find(sel).remove();
  });

  const items: string[] = [];

  // =========================
  // 1. DETAILS / ACCORDION
  // =========================
  clone.find('details').each((_: number, el: any) => {
    const $el = $(el);

    const title = cleanText($el.find('summary').first().text());

    // берём ВСЁ кроме summary
    const bodyClone = $el.clone();
    bodyClone.find('summary').remove();

    const bodyText = cleanText(bodyClone.text());

    if (bodyText) {
      items.push(title ? `${title}: ${bodyText}` : bodyText);
    }
  });

  // =========================
  // 2. LI
  // =========================
  const liItems = clone.find('li');

  if (liItems.length) {
    liItems.each((_: number, el: Element) => {
      const text = cleanText($(el).text());
      if (text) items.push(text);
    });
  }

  // =========================
  // 3. P (НО только НЕ внутри details)
  // =========================
  const paragraphs = clone.find('p');

  if (paragraphs.length) {
    paragraphs.each((_: number, el: Element) => {
      const $p = $(el);

      // избегаем дубля если уже обработали details
      if ($p.closest('details').length) return;

      const text = cleanText($p.text());
      if (text) items.push(text);
    });
  }

  // =========================
  // 4. BR fallback
  // =========================
  const html = clone.html() || '';

  const parts: string[] = [];

  clone.contents().each((_: string, node: Element) => {
    const el = $(node);

    if (el.is('details')) {
      const title = cleanText(el.find('summary').first().text());

      const bodyText = cleanText(el.clone().find('summary').remove().end().text());

      if (bodyText) {
        parts.push(title ? `${title}: ${bodyText}` : bodyText);
      }

      return;
    }

    // 2. paragraphs
    if (el.is('p')) {
      const text = cleanText(el.text());
      if (text) parts.push(text);
      return;
    }

    // 3. fallback text nodes
    const text = cleanText(el.text());
    if (text) parts.push(text);
  });

  if (parts.length) {
    items.push(...parts);
  }

  // =========================
  // 5. fallback
  // =========================
  if (!items.length) {
    const text = cleanText(clone.text());
    if (text) items.push(text);
  }

  return items;
}

/**
 * Очистка текста
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/•/g, '').trim();
}

/**
 * Сборка итогового UL списка
 */
function buildUl(items: string[], separator: string): string {
  const unique = Array.from(new Set(items));

  if (!unique.length) return '';

  const li = unique.map((t) => `<li>${t}</li>`).join(separator);

  return `<ul>${separator}${li}${separator}</ul>`;
}
