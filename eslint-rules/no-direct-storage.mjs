/**
 * Файли — лише через порт `simplycms/storage` за serverFn (рішення Е2-9).
 *
 * 🔴 Власне правило, а не `no-restricted-syntax`: блок із цим правилом на
 * `packages/simplycms/src/**` замістив би i18n-селектори адмінки й воронки
 * (flat config замінює опції правила цілком). Окреме імʼя плагіна робить
 * зону адитивною.
 *
 * Ловить три форми: `supabase.storage`, `<що-завгодно>.storage.from(...)`
 * та імпорт `@supabase/storage-js`.
 */
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      direct:
        'Прямий виклик сховища заборонений — завантаження й видалення лише ' +
        'через simplycms/storage за serverFn (рішення Е2-9, етап К3-Е2).',
    },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'direct' });
    return {
      // supabase.storage / client.storage — доступ до властивості
      "MemberExpression[computed=false][property.name='storage']"(node) {
        report(node);
      },
      // x['storage'] — обхід крізь обчислений доступ
      "MemberExpression[computed=true][property.value='storage']"(node) {
        report(node);
      },
      "ImportDeclaration[source.value='@supabase/storage-js']"(node) {
        report(node);
      },
    };
  },
};
