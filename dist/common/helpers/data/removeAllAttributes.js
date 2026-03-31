"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAllAttributes = removeAllAttributes;
//todo не работает
function removeAllAttributes(input) {
    let root;
    // если передали весь DOM
    if (typeof input === 'function') {
        root = input('body').length ? input('body') : input.root();
    }
    else {
        // если передали элементы
        root = input;
    }
    root.find('*').each((_, el) => {
        if (el.type !== 'tag')
            return;
        const element = el;
        const $el = root.constructor(el); // создаём cheerio-обёртку
        for (const attr in element.attribs || {}) {
            $el.removeAttr(attr);
        }
    });
    return input;
}
