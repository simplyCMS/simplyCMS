import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { defineOperation } from 'simplycms/operations';
import { advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { createPathsForEntity } from 'simplycms/addressing';
import { SLUG_FORMAT, slugify } from 'simplycms/domain/slugs';
import { planTranslationWrite } from 'simplycms/domain/translations';
import { getLanguagePack } from 'simplycms/i18n';
import { products } from 'simplycms/schema';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  primaryLocaleCode,
  sourceFieldHash,
} from 'simplycms/translations';
import { assertKnownLocales } from './load';
import { mirrorColumns } from './mirror';
import {
  productBase,
  remapPlanIssues,
  stockStatus,
  textsByLocale,
  toPatchMap,
} from './schemas';

const SPEC = TRANSLATABLE.product;

const input = productBase.extend({
  id: z.uuid(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  hasModifications: z.boolean().default(true),
  stockStatus: stockStatus.default('in_stock'),
  texts: textsByLocale,
  /** Адреса основної мови; без неї — `slugify(name)`. Для нелатинського письма без пакета обов'язкова. */
  path: z.string().max(255).optional(),
});

const pathRequired = () =>
  new ValidationError([
    {
      path: ['path'],
      code: 'too_small',
      params: { minimum: 1, origin: 'string' },
    },
  ]);

export const productsCreate = defineOperation({
  id: 'products.create',
  permission: 'catalog.write',
  idempotent: 'create',
  versioned: true,
  input,
  output: z.object({
    id: z.uuid(),
    version: z.number().int(),
    paths: z.record(z.string(), z.string()),
  }),
  async run({ db }, data) {
    // Спільний замок набору мов ПЕРШИМ: далі й валідація мов, і генератор адрес
    // бачать один незмінний набір (Review Focus 1).
    await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
    const primary = await primaryLocaleCode(db);
    await assertKnownLocales(db, Object.keys(data.texts), (l) => ['texts', l]);
    const plan = remapPlanIssues(['texts'], () =>
      planTranslationWrite({
        spec: SPEC,
        current: { source: null, byLocale: new Map() },
        primary,
        patch: toPatchMap(data.texts),
        hash: sourceFieldHash,
      }),
    );
    const name = plan.upserts.find((u) => u.locale === primary)?.values.name;
    // Основна мова з назвою обов'язкова (І4, до тригера Task 17 — тут): план
    // перевіряє її лише коли основну мову надіслано, а відсутню мову не бачить.
    if (!name)
      throw new ValidationError([
        {
          path: ['texts', primary, 'name'],
          code: 'too_small',
          params: { minimum: 1, origin: 'string' },
        },
      ]);
    const baseSlug = data.path ?? slugify(name, getLanguagePack(primary));
    if (!baseSlug) throw pathRequired();
    if (!SLUG_FORMAT.test(baseSlug))
      throw new ValidationError([{ path: ['path'], code: 'invalid_format' }]);
    const { id } = data;
    // М1-TEMP: зноситься в Task 17 — старі колонки дзеркалять основну мову, а
    // `slug` (NOT NULL UNIQUE) спершу `id`: адреса виникає лише після рядка товару.
    await db.insert(products).values({
      id,
      sectionId: data.sectionId,
      sku: data.sku,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      hasModifications: data.hasModifications,
      stockStatus: data.stockStatus,
      version: 1,
      slug: id,
      name,
      ...mirrorColumns(plan, primary),
    });
    await applyTranslationPlan(db, SPEC, id, plan);
    const paths = await createPathsForEntity(
      db,
      { kind: 'product', id },
      baseSlug,
    );
    const own = paths.get(primary);
    if (!own) throw new Error('[products.create] немає адреси основної мови');
    // М1-TEMP: зноситься в Task 17
    await db.update(products).set({ slug: own }).where(eq(products.id, id));
    return { id, version: 1, paths: Object.fromEntries(paths) };
  },
});
