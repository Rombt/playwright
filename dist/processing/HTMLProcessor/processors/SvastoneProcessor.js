"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SvastoneProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class SvastoneProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        const listHtml = (0, helpers_1.normalizeDomToList)(dom);
        // const result: string[] = [];
        // dom('details.spoilers__item').each((_, el) => {
        //   const $el = dom(el);
        //   const title = $el.find('summary.spoilers__title').first().text().trim();
        //   const body = $el.find('.spoilers__body .text').first();
        //   const bodyHtml = body.html()?.trim();
        //   if (!title && !bodyHtml) return;
        //   // 3. Формируем <li>
        //   const li = `
        //         <li>
        //           ${title ? `<strong>${title}</strong>` : ''}
        //           ${bodyHtml ? `<div>${bodyHtml}</div>` : ''}
        //         </li>
        //       `;
        //   result.push(li);
        // });
        // const listHtml = `<ul>${result.join('')}</ul>`;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: listHtml,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.SvastoneProcessor = SvastoneProcessor;
