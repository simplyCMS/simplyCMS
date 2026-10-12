/** Листи ядра (скидання пароля, запрошення власника). */
export const messages = {
  'mail.reset.subject': 'Скидання пароля — {storeName}',
  'mail.reset.intro':
    'Ви (або хтось інший) попросили скинути пароль у магазині «{storeName}».',
  'mail.reset.openLink': 'Щоб задати новий пароль, відкрийте посилання:',
  'mail.reset.action': 'Задати новий пароль',
  'mail.reset.ignore':
    'Якщо ви цього не робили — просто проігноруйте лист, пароль лишиться попереднім.',
  'mail.invite.subject': 'Запрошення власника — {storeName}',
  'mail.invite.intro': 'Вас запрошено власником магазину «{storeName}».',
  'mail.invite.openLink': 'Щоб задати пароль і увійти, відкрийте посилання:',
  'mail.invite.action': 'Задати пароль і увійти',
  'mail.invite.ttl': 'Посилання одноразове й дійсне {hours} год.',
  'mail.invite.ignore':
    'Якщо ви не чекали цього листа — просто проігноруйте його.',
} satisfies Record<string, string>;
