import type { Table } from 'drizzle-orm';
import type { Operation } from 'simplycms/auth';
import type { ActorDb } from 'simplycms/db';
import type { RichHtmlProfile } from 'simplycms/sanitize';
import type {
  ColumnName,
  InsertPick,
  ResourceRefine,
} from './resource-schemas';

/** Пакет запису, який бачить guard-хук (Е6а-16): УВЕСЬ batch, не рядок. */
export type ResourceGuardWrite<Insert, Patch> =
  | { kind: 'insert'; rows: readonly Insert[] }
  | { kind: 'update'; updates: readonly { id: string; patch: Patch }[] };

/** Guard-хук (Е6а-16): відмова — `throw` (`stateConflict`), увесь пакет відкочується. */
export type ResourceGuard<Insert, Patch> = (
  db: ActorDb,
  write: ResourceGuardWrite<Insert, Patch>,
) => Promise<void>;

/**
 * Конфіг фабрики `defineAdminResource` (винесено з `resource.ts` без зміни
 * типів, фінальне рев'ю Е5 п.6). Генерики: `W` — writable, `R` — readonly,
 * `I` — insertOnly (Е4-5), `O` — omit (Е5-7).
 */
export interface AdminResourceConfigBase<
  T extends Table,
  W extends ColumnName<T>,
  R extends ColumnName<T>,
  I extends ColumnName<T>,
  O extends ColumnName<T>,
> {
  entity: string;
  table: T;
  operation: Operation;
  mode: 'eager' | 'on-demand';
  // 🔴 Е5-7: прихована колонка не фільтрується й не сортується — інакше
  //   subset став би оракулом її значення (напр. перебір access_token).
  // filterable — eq/gt/gte/lt/lte/in/isNull; sortable — сортування і, крім того,
  //   eq/gt/gte/lt/lte (курсор «Показати ще», див. `subset.ts`); in/isNull по
  //   sortable заборонені.
  filterable: readonly Exclude<ColumnName<T>, O>[];
  sortable: readonly Exclude<ColumnName<T>, O>[];
  defaultOrder?: {
    column: Exclude<ColumnName<T>, O>;
    direction: 'asc' | 'desc';
  };
  writable: readonly W[];
  /** Е4-5: колонки, що пишуться лише при створенні (insert), а не при
   *  update — напр. тип властивості, зміна якого зламала б значення. */
  insertOnly?: readonly I[];
  readonly: readonly R[];
  /** Е5-7: колонки, яких немає ні в SELECT/RETURNING, ні в типі рядка, ні
   *  в схемах — секрети на кшталт `orders.access_token`, браузеру зайві. */
  omit?: readonly O[];
  /** Е5-12: серверна межа сторінки `list` — ефективний ліміт
   *  `min(subset.limit ?? maxLimit, maxLimit)`. Без неї — як раніше. */
  maxLimit?: number;
  /** Колонка, яку фабрика ставить у new Date() на кожен update (Е3-9:
   *  тригера updated_at у каноні немає). Прихована (`omit`) — заборонена
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
  /** Е6а-16: advisory-ключ (`lockCatalogTarget`) — ПЕРШИЙ запит транзакції
   *  insert/update. Без нього поведінка фабрики незмінна. */
  lock?: string;
  /** Е6а-16: інваріант запису над УСІМ пакетом insert/update — після `lock`,
   *  до запису, у тій самій транзакції. */
  guard?: ResourceGuard<
    NoInfer<InsertPick<T, W | I> & { id: string }>,
    NoInfer<Partial<InsertPick<T, W>>>
  >;
}

/**
 * 🔴 Exhaustiveness (вимога спеки): кожна колонка мусить бути рівно в
 * одному зі списків — writable, insertOnly (Е4-5), readonly або omit (Е5-7)
 * — інакше конфіг не типізується (фантомні поля __missingColumns /
 * __overlappingColumns називають винні колонки).
 *
 * 🔴 Перетин теж заборонений: колонка в ОБОХ списках — writable виграв би
 * мовчки (напр., createdAt став би перезаписуваним). Те саме для insertOnly
 * (Е4-5): з writable колонка стала б перезаписуваною в update, з readonly —
 * записуваною в insert. Е5-7: прихована колонка (omit) не може бути ні в
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
