import type { PluginMessages } from 'simplycms/plugin-sdk';

/** Каталог плагіна faq. Префікс `plugin.faq.` — обовʼязковий неймспейс. */
export const messages = {
  uk: {
    'plugin.faq.title': 'Часті питання',
    'plugin.faq.adminTitle': 'FAQ',
    'plugin.faq.adminSubtitle': 'Питання й відповіді до товарів',
    'plugin.faq.question': 'Питання',
    'plugin.faq.answer': 'Відповідь',
    'plugin.faq.productId': 'ID товару (порожньо — загальне питання)',
    'plugin.faq.sortOrder': 'Порядок',
    'plugin.faq.active': 'Активне',
    'plugin.faq.add': 'Додати питання',
    'plugin.faq.delete': 'Видалити',
    'plugin.faq.empty': 'Питань ще немає',
    'plugin.faq.saved': 'Збережено',
    'plugin.faq.error': 'Помилка',
  },
  en: {
    'plugin.faq.title': 'Frequently asked questions',
    'plugin.faq.adminTitle': 'FAQ',
    'plugin.faq.adminSubtitle': 'Questions and answers for products',
    'plugin.faq.question': 'Question',
    'plugin.faq.answer': 'Answer',
    'plugin.faq.productId': 'Product ID (empty — general question)',
    'plugin.faq.sortOrder': 'Sort order',
    'plugin.faq.active': 'Active',
    'plugin.faq.add': 'Add question',
    'plugin.faq.delete': 'Delete',
    'plugin.faq.empty': 'No questions yet',
    'plugin.faq.saved': 'Saved',
    'plugin.faq.error': 'Error',
  },
} satisfies PluginMessages;

/** Локальний union ключів — перевірка одруків у межах ВЛАСНОГО каталогу. */
export type FaqKey = keyof typeof messages.uk;
