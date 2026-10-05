// `simplycms/sanitize` — server-only санітизація rich-HTML (T2). Тип
// `SanitizedHtml` живе в T0 (`simplycms/contracts`), щоб його бачили теми.
export {
  sanitizeRichHtml,
  sanitizeNullableRichHtml,
  type RichHtmlProfile,
} from './rich-html';
