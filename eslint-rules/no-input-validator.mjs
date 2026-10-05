/**
 * Заборона `.inputValidator(...)` — лише `.validator(...)`.
 *
 * `inputValidator` у `@tanstack/start-client-core` — @deprecated-аліас
 * `validator`: той самий `setValidator`, той самий `ValidatorFn`, той самий
 * `execValidator`, а компілятор Start трактує обидва однаково й лише друкує
 * попередження (95 викликів × 3 трансформ-проходи = 285 рядків шуму на кожну
 * збірку). Правило не дає старому імені повернутися.
 *
 * 🔴 Власне правило з власним імʼям плагіна, а не `no-restricted-syntax`:
 * flat config замінює опції правила цілком, тож ще один блок на тих самих
 * файлах замістив би i18n-селектори.
 *
 * Ловить `x.inputValidator(...)` на будь-якому ланцюжку (`createServerFn()`,
 * `createMiddleware()`) і обчислений доступ `x['inputValidator']`.
 */
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      deprecated:
        '`inputValidator` — застарілий аліас у TanStack Start: використовуй ' +
        '`.validator()` (та сама поведінка, без попереджень компілятора).',
    },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'deprecated' });
    return {
      "MemberExpression[computed=false][property.name='inputValidator']"(node) {
        report(node.property);
      },
      "MemberExpression[computed=true][property.value='inputValidator']"(node) {
        report(node.property);
      },
    };
  },
};
