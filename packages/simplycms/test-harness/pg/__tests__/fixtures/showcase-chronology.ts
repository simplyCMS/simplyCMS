// Хронологія засіяної бази (С-3, SHOWCASE-2): після зсуву часу жодна подія
// покупця не раніша за його реєстрацію, а номер замовлення несе дату самого
// замовлення. Кожна колонка — лічильник порушень, норма — нуль.
export type Chronology = {
  ordersBeforeRegistration: number;
  historyBeforeRegistration: number;
  bannedBeforeRegistration: number;
  updatedBeforeCreated: number;
  profileRegistrationMismatch: number;
  malformedNumbers: number;
  numberDateMismatch: number;
  minRegistrationDay: number;
  maxOrderDay: number;
};

const DAYS = (col: string) =>
  `round(extract(epoch from now() - ${col}) / 86400)::int`;

export const CHRONOLOGY = `
  select
    (select count(*)::int from public.orders o
       join public.users u on u.id = o.user_id
      where o.created_at < u.created_at) as "ordersBeforeRegistration",
    (select count(*)::int from public.user_category_history h
       join public.users u on u.id = h.user_id
      where h.created_at < u.created_at) as "historyBeforeRegistration",
    (select count(*)::int from public.users
      where banned_at < created_at) as "bannedBeforeRegistration",
    (select count(*)::int from public.users
      where updated_at < created_at) +
    (select count(*)::int from public.orders
      where updated_at < created_at) as "updatedBeforeCreated",
    -- Профіль (registrationDays автоправил) — та сама реєстрація, що й users.
    (select count(*)::int from public.profiles p
       join public.users u on u.id = p.user_id
      where abs(extract(epoch from p.created_at - u.created_at)) > 86400)
      as "profileRegistrationMismatch",
    (select count(*)::int from public.orders
      where order_number !~ '^[0-9]{6}-[0-9A-F]{6}$') as "malformedNumbers",
    -- Префікс як у generateOrderNumber: UTC-дата YYMMDD.
    (select count(*)::int from public.orders
      where left(order_number, 6)
            <> to_char(created_at at time zone 'UTC', 'YYMMDD')) as "numberDateMismatch",
    (select min(${DAYS('created_at')}) from public.users) as "minRegistrationDay",
    (select max(${DAYS('created_at')}) from public.orders) as "maxOrderDay"
`;
