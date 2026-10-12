import { describe, expect, it } from 'vitest';
import { createTranslator } from 'simplycms/i18n';
import {
  renderOrderCustomerMail,
  renderOrderOwnerMail,
  type OrderMailData,
} from 'simplycms/mail';

const STORE = 'Магазин "Сонце" <тест>';
const ORDER: OrderMailData = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: '261012-ABC123',
  firstName: 'Іван',
  lastName: 'Петренко',
  phone: '+380501112233',
  email: 'buyer@example.test',
  deliveryCity: 'Київ',
  deliveryAddress: 'вул. <Хрещатик>, 1',
  items: [
    { name: 'Панель <450>', quantity: 2, price: 4800 },
    { name: 'Інвертор', quantity: 1, price: 100.5 },
  ],
  subtotal: 9700.5,
  shippingCost: 50,
  total: 9750.5,
};

describe.each(['uk', 'en'] as const)(
  'рендер листів замовлення, %s',
  (locale) => {
    const t = createTranslator(locale);

    it('лист покупцю: номер у темі, склад і підсумки в тексті, каталог розв’язано', () => {
      const mail = renderOrderCustomerMail({
        to: 'buyer@example.test',
        order: ORDER,
        storeName: STORE,
        t,
      });
      expect(mail.kind).toBe('order_customer');
      expect(mail.to).toBe('buyer@example.test');
      expect(mail.subject).toContain(ORDER.orderNumber);
      expect(mail.text).toContain('9600.00');
      expect(mail.text).toContain('9750.50');
      expect(mail.text).not.toContain('mail.order.');
      expect(mail.html).toContain('Панель &lt;450&gt;');
      expect(mail.html).not.toContain('<450>');
    });

    it('лист власнику: посилання на адмінку, контакти покупця, HTML екранований', () => {
      const adminUrl = `https://shop.example/admin/orders/${ORDER.id}`;
      const mail = renderOrderOwnerMail({
        to: 'owner@shop.test',
        order: ORDER,
        storeName: STORE,
        adminUrl,
        t,
      });
      expect(mail.kind).toBe('order_owner');
      expect(mail.subject).not.toContain('https://');
      expect(mail.text).toContain(adminUrl);
      expect(mail.text).toContain('+380501112233');
      expect(mail.text).not.toContain('mail.order.');
      expect(mail.html).toContain(`href="${adminUrl}"`);
      expect(mail.html).toContain('вул. &lt;Хрещатик&gt;, 1');
    });

    it('лист власнику без email покупця не друкує порожній рядок', () => {
      const mail = renderOrderOwnerMail({
        to: 'owner@shop.test',
        order: { ...ORDER, email: '' },
        storeName: STORE,
        adminUrl: 'https://shop.example/admin/orders/x',
        t,
      });
      expect(mail.text).toContain(t('mail.order.owner.noEmail'));
    });
  },
);
