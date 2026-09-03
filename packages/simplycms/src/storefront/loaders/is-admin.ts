import { getRequest } from '@tanstack/react-start/server';
import { isAdminRequest } from 'simplycms/auth';

/**
 * Чи має поточний користувач роль admin — ЗВИЧАЙНА функція.
 *
 * Саме її викликають server-route handler-и (`server.handlers.*`): у них немає
 * контексту `createServerFn`, тому виклик serverFn-обгортки там впав би.
 * Без сесії → `false`.
 *
 * 🔴 Контур — Better Auth (К1′б): і ідентичність, і роль тепер приходять з
 * Postgres (`simplycms/auth` → `withActor`). Гібрид «GoTrue дає id, Postgres
 * дає роль» знято разом із GoTrue.
 *
 * 🔴 Живе в ОКРЕМОМУ модулі, а не поруч із serverFn-ами в `auth.ts`.
 * Трансформація TanStack Start вирізає з клієнтського бандла тіла
 * `createServerFn`-хендлерів, після чого їхні серверні імпорти стають
 * невживаними і зникають. Звичайна функція такого імунітету не має: як живий
 * експортований символ вона тримає серверний імпорт живим, а в опублікованому
 * пакеті сусідні модулі вже склеєні в один чанк бандлера — тож клієнтський
 * `import { getUser } from '…/server/auth'` (`admin-routes/routes/admin.tsx`)
 * затягнув би сюди і Better Auth, і пул Postgres. У монорепо цього не видно:
 * там Vite бачить сирці й вирізає невживане. Спіймано Gate C пілота.
 */
export async function checkIsAdmin(): Promise<boolean> {
  return isAdminRequest(getRequest().headers);
}
