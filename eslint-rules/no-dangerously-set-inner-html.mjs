/**
 * `dangerouslySetInnerHTML` — лише в `<RichHtml>` і в явному списку винятків
 * (Тема 9, санітизація HTML).
 *
 * 🔴 Власне правило з ВЛАСНИМ іменем плагіна, а не `no-restricted-syntax`:
 * flat config замінює опції правила цілком, тож ще один блок
 * `no-restricted-syntax` на тих самих файлах замістив би i18n-селектори.
 *
 * Ловить обидві форми: JSX-атрибут `<div dangerouslySetInnerHTML={…}/>` і
 * ключ обʼєкта props (`createElement('div', { dangerouslySetInnerHTML })`,
 * `{...{ dangerouslySetInnerHTML }}`), включно з обчисленим `['…']`.
 * Винятки задає конфіг (`ignores` блоку в `eslint.config.mjs`) — з причиною
 * для кожного.
 */
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      forbidden:
        'dangerouslySetInnerHTML заборонений: розмітку контенту рендерить ' +
        'лише <RichHtml html={SanitizedHtml}/> (simplycms/ui/rich-html), ' +
        'а SanitizedHtml створює тільки серверний sanitizeRichHtml. Нові ' +
        'винятки — явним записом із причиною в eslint.config.mjs.',
    },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'forbidden' });
    return {
      "JSXAttribute[name.name='dangerouslySetInnerHTML']": report,
      "Property[key.name='dangerouslySetInnerHTML']": report,
      "Property[key.value='dangerouslySetInnerHTML']": report,
    };
  },
};
