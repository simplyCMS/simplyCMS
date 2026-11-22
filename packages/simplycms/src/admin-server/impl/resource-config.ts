import type { Table } from 'drizzle-orm';
import type { Operation } from 'simplycms/auth';
import type { ActorDb } from 'simplycms/db';
import type { MediaEntityType } from 'simplycms/domain/media';
import type { RichHtmlProfile } from 'simplycms/sanitize';
import type { ResourceCascadeMedia } from './resource-cascade-media';
import type { ReadFieldName, ReadModelSpec } from './resource-read-model';
import type {
  ColumnName,
  InsertPick,
  ResourceRefine,
} from './resource-schemas';

/**
 * Пакет запису, який бачить guard-хук: УВЕСЬ batch, не рядок.
 * `before` — знімок старого рядка під `FOR UPDATE` (перехресні
 * правила перевіряються на злитому рядку); заповнюється, коли ресурс має
 * `media`. Наявні guard-и поля не читають — воно опційне.
 */
export type ResourceGuardWrite<Insert, Patch> =
  | { kind: 'insert'; rows: readonly Insert[] }
  | {
      kind: 'update';
      updates: readonly { id: string; patch: Patch; before?: Insert }[];
    };

/** Guard-хук: відмова — `throw` (`stateConflict`), увесь пакет відкочується. */
export type ResourceGuard<Insert, Patch> = (
  db: ActorDb,
  write: ResourceGuardWrite<Insert, Patch>,
) => Promise<void>;

/**
 * Конфіг фабрики `defineAdminResource` (винесено з `resource.ts` без зміни
 * типів). Генерики: `W` — writable, `R` — readonly,
 * `I` — insertOnly, `O` — omit.
 */
export interface AdminResourceConfigBase<
  T extends Table,
  W extends ColumnName<T>,
  R extends ColumnName<T>,
  I extends ColumnName<T>,
  O extends ColumnName<T>,
  RM extends ReadModelSpec | undefined = undefined,
> {
  entity: string;
  table: T;
  operation: Operation;
  mode: 'eager' | 'on-demand';
  // 🔴 Прихована колонка не фільтрується й не сортується — інакше
  //   subset став би оракулом її значення (напр. перебір access_token).
  // filterable — eq/gt/gte/lt/lte/in/isNull; sortable — сортування і, крім того,
  //   eq/gt/gte/lt/lte (курсор «Показати ще», див. `subset.ts`); in/isNull по
  //   sortable заборонені.
  // Поля read-model (`readModel.fields`) теж можна називати: після зносу дзеркальної колонки
  // `sortable: ['name']` лишається чинним, а одрук ловить typecheck.
  filterable: readonly (Exclude<ColumnName<T>, O> | ReadFieldName<RM>)[];
  sortable: readonly (Exclude<ColumnName<T>, O> | ReadFieldName<RM>)[];
  defaultOrder?: {
    column: Exclude<ColumnName<T>, O> | ReadFieldName<RM>;
    direction: 'asc' | 'desc';
  };
  writable: readonly W[];
  /** Колонки, що пишуться лише при створенні (insert), а не при
   *  update — напр. тип властивості, зміна якого зламала б значення. */
  insertOnly?: readonly I[];
  readonly: readonly R[];
  /** Колонки, яких немає ні в SELECT/RETURNING, ні в типі рядка, ні
   *  в схемах — секрети на кшталт `orders.access_token`, браузеру зайві. */
  omit?: readonly O[];
  /** Читальна вибірка `list` з таблиці перекладів основної мови замість
   *  дзеркальних колонок (`resource-read-model.ts`). Тип рядка `list` стає read-model. */
  readModel?: RM;
  /** Серверна межа сторінки `list` — ефективний ліміт
   *  `min(subset.limit ?? maxLimit, maxLimit)`. Без неї — як раніше. */
  maxLimit?: number;
  /** Колонка, яку фабрика ставить у new Date() на кожен update
   *  (тригера updated_at у каноні немає). Прихована (`omit`) — заборонена
   *  типом: штамп писав би колонку повз видимий контракт ресурсу. */
  touch?: Exclude<ColumnName<T>, O>;
  /** m3 (рев'ю хвилі B): рефайнменти генератора схем для колонок без власної
   *  форми (jsonb без `.$type<>()` — `resource-schemas.ts`). */
  refine?: ResourceRefine;
  /** Тема 9: колонки з розміткою rich-text редактора → профіль санітизатора
   *  (`simplycms/sanitize`). Санітизація — пост-парс трансформація значення в
   *  generic-write (insert/update) і при віддачі рядків клієнту (list/RETURNING:
   *  старі рядки, сід, демо-дані). Схеми (`columnsToZod`) НЕ змінюються. Лише
   *  записувані колонки: розмітка в readonly/omit-колонці не має власника. */
  // `NoInfer`: ключі лише ЗВІРЯЮТЬСЯ з writable/insertOnly, а не виводять W.
  richHtml?: { readonly [K in NoInfer<W | I>]?: RichHtmlProfile };
  /** Advisory-ключ (`lockCatalogTarget`) — ПЕРШИЙ запит транзакції
   *  insert/update. Без нього поведінка фабрики незмінна. */
  lock?: string;
  /** Інваріант запису над УСІМ пакетом insert/update — після `lock`,
   *  до запису, у тій самій транзакції. */
  guard?: ResourceGuard<
    NoInfer<InsertPick<T, W | I> & { id: string }>,
    NoInfer<Partial<InsertPick<T, W>>>
  >;
  /** Колонки-референси на файли сутності `entityType` (лише
   *  writable `text`; jsonb-масиви — лише в `cascadeMedia`). Фабрика
   *  перевіряє нові референси, стирає рядки `media` заміненого/видаленого в
   *  транзакції, а файли — після COMMIT. */
  media?: { entityType: MediaEntityType; columns: readonly NoInfer<W>[] };
  /** Дочірні таблиці, які FK `ON DELETE CASCADE` видаляє разом із
   *  рядком ресурсу і які несуть медіа. `remove` стирає їхні рядки `media` у
   *  тій самій транзакції, а файли — після COMMIT. Покриття звіряє гейт класу
   *  `media-cascade-coverage` з каталогом FK. */
  cascadeMedia?: readonly ResourceCascadeMedia[];
  /** Блокування кореня агрегата ПЕРЕД видаленням: `remove` не має guard-а,
   *  а каскад медіа мусить серіалізуватись з командами агрегата (`FOR NO KEY UPDATE`
   *  кореня), інакше паралельна команда додасть посилання між перевіркою і COMMIT. */
  lockOnRemove?: (db: ActorDb, ids: readonly string[]) => Promise<void>;
  /** Власний DELETE рядків замість узагальненого: таблиця з єдиним
   *  видалячем (`product_modifications` -> `deleteModifications`) і ресурс, що мусить
   *  прибрати дочірні рядки в узгодженому порядку замків до власного DELETE. Іде після
   *  знімків медіа, тож стирання медіа не змінюється. */
  deleteRows?: (
    db: ActorDb,
    ids: readonly string[],
  ) => Promise<{ count: number }>;
}

/**
 * 🔴 Exhaustiveness (вимога спеки): кожна колонка мусить бути рівно в
 * одному зі списків — writable, insertOnly, readonly або omit
 * — інакше конфіг не типізується (фантомні поля __missingColumns /
 * __overlappingColumns називають винні колонки).
 *
 * 🔴 Перетин теж заборонений: колонка в ОБОХ списках — writable виграв би
 * мовчки (напр., createdAt став би перезаписуваним). Те саме для insertOnly:
 * з writable колонка стала б перезаписуваною в update, з readonly —
 * записуваною в insert. Прихована колонка (omit) не може бути ні в
 * жодному списку.
 */
export type AdminResourceColumnGuards<
  T extends Table,
  W extends ColumnName<T>,
  R extends ColumnName<T>,
  I extends ColumnName<T>,
  O extends ColumnName<T>,
> = ([Exclude<ColumnName<T>, W | R | I | O>] extends [never]
  ? unknown
  : { __missingColumns: Exclude<ColumnName<T>, W | R | I | O> }) &
  ([Extract<W, R> | Extract<I, W | R> | Extract<O, W | R | I>] extends [never]
    ? unknown
    : {
        __overlappingColumns:
          Extract<W, R> | Extract<I, W | R> | Extract<O, W | R | I>;
      });
