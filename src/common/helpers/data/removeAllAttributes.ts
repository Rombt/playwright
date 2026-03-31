import { CheerioAPI, Cheerio } from 'cheerio';
import { Element, AnyNode } from 'domhandler';

//todo не работает
export function removeAllAttributes(
  input: CheerioAPI | Cheerio<AnyNode>,
): CheerioAPI | Cheerio<AnyNode> {
  let root: Cheerio<AnyNode>;

  // если передали весь DOM
  if (typeof input === 'function') {
    root = input('body').length ? input('body') : input.root();
  } else {
    // если передали элементы
    root = input;
  }

  root.find('*').each((_, el) => {
    if (el.type !== 'tag') return;

    const element = el as Element;

    const $el = root.constructor(el); // создаём cheerio-обёртку

    for (const attr in element.attribs || {}) {
      $el.removeAttr(attr);
    }
  });

  return input;
}
