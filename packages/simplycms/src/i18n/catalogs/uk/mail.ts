/** Листи ядра (скидання пароля, запрошення власника, замовлення). */
export const messages = {
  'mail.reset.subject': 'Скидання пароля — {storeName}',
  'mail.reset.intro':
    'Ви (або хтось інший) попросили скинути пароль у магазині «{storeName}».',
  'mail.reset.openLink': 'Щоб задати новий пароль, відкрийте посилання:',
  'mail.reset.action': 'Задати новий пароль',
  'mail.reset.ignore':
    'Якщо ви цього не робили — просто проігноруйте лист, пароль лишиться попереднім.',
  'mail.verify.subject': 'Підтвердіть пошту — {storeName}',
  'mail.verify.intro':
    'Ви зареєструвалися в магазині «{storeName}». Підтвердіть, що ця пошта ваша.',
  'mail.verify.openLink': 'Щоб підтвердити пошту, відкрийте посилання:',
  'mail.verify.action': 'Підтвердити пошту',
  'mail.verify.ignore':
    'Якщо ви не реєструвалися — просто проігноруйте лист, акаунт не буде активовано.',
  'mail.invite.subject': 'Запрошення власника — {storeName}',
  'mail.invite.intro': 'Вас запрошено власником магазину «{storeName}».',
  'mail.invite.openLink': 'Щоб задати пароль і увійти, відкрийте посилання:',
  'mail.invite.action': 'Задати пароль і увійти',
  'mail.invite.ttl': 'Посилання одноразове й дійсне {hours} год.',
  'mail.invite.ignore':
    'Якщо ви не чекали цього листа — просто проігноруйте його.',
  'mail.order.customer.subject':
    'Замовлення №{orderNumber} прийнято — {storeName}',
  'mail.order.customer.intro':
    'Дякуємо за замовлення в магазині «{storeName}». Номер вашого замовлення: {orderNumber}.',
  'mail.order.line': '{name} × {quantity} — {total}',
  'mail.order.subtotal': 'Товари: {amount}',
  'mail.order.shipping': 'Доставка: {amount}',
  'mail.order.total': 'Разом: {amount}',
  'mail.order.owner.subject': 'Нове замовлення №{orderNumber} — {storeName}',
  'mail.order.owner.intro':
    'У магазині «{storeName}» нове замовлення №{orderNumber}.',
  'mail.order.owner.customer': 'Покупець: {name}, {phone}, {email}',
  'mail.order.owner.noEmail': 'email не вказано',
  'mail.order.owner.delivery': 'Доставка: {address}',
  'mail.order.owner.openLink':
    'Щоб відкрити замовлення в адмінці, перейдіть за посиланням:',
  'mail.order.owner.action': 'Відкрити замовлення',
} satisfies Record<string, string>;
