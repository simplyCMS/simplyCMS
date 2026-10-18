import {
  ADMIN_STATE_CONSTRAINT,
  AdminConflictError,
} from 'simplycms/contracts/domain-errors';
import { currentPathOwners } from 'simplycms/addressing';
import type { ActorDb } from 'simplycms/db';
import { primaryLocaleCode } from 'simplycms/translations';

/**
 * І19 у зворотному напрямку: генератор адрес не дає шляху, що дорівнює коду НАЯВНОЇ мови,
 * а тут — нова мова не бере код, який уже є поточною адресою основної мови (перший сегмент
 * URL = `lower(code)`). Інакше розбір префікса вважав би `/it` мовою (навіть `draft`), і
 * товар з адресою `it` зникав би з вітрини (404) у момент ДОДАВАННЯ мови. Відмова 409 з
 * переліком сутностей — власник змінює адресу або обирає інший код.
 *
 * Історичні адреси не блокують: історія не видаляється, і мову з таким кодом інакше не
 * додати ніколи. Ціна — старе посилання `/it` після додавання мови `it` веде на сторінку
 * мови, а не 301 на поточну адресу товару (`translations.md`).
 *
 * Кличеться під ЕКСКЛЮЗИВНИМ `languages-set` (`languages.add`): творці адрес тримають
 * спільний, тож між перевіркою і вставкою мови нова поточна адреса не з'явиться.
 */
export async function assertCodeNotAnAddress(
  db: ActorDb,
  code: string,
): Promise<void> {
  const owners = await currentPathOwners(
    db,
    await primaryLocaleCode(db),
    code.toLowerCase(),
  );
  if (owners.length === 0) return;
  throw new AdminConflictError(
    'state',
    ADMIN_STATE_CONSTRAINT.languageCodeTaken,
    Object.fromEntries(
      owners.map((o) => [`${o.target.kind}:${o.target.id}`, o.path]),
    ),
  );
}
