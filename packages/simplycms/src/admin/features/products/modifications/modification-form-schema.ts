import { z } from 'zod';
import { SLUG_RE } from '../edit/product-form-schema';

/**
 * Значення форми модифікації. Назва й токен — за мовами (`names`, `tokens`);
 * фото — ключі сховища цієї модифікації. Статусу наявності тут немає: його
 * виводить облік залишків (`products.saveStock`), а не форма.
 */
export const modificationFormSchema = z.object({
  names: z.record(z.string(), z.string().trim()),
  tokens: z.record(z.string(), z.string().trim()),
  sku: z.string().trim(),
  isDefault: z.boolean(),
  stockStatus: z.enum(['in_stock', 'out_of_stock', 'on_order']),
  images: z.array(z.string()),
});
export type ModificationFormValues = z.infer<typeof modificationFormSchema>;

/** Назва основною мовою обовʼязкова (І4), токен — у форматі адреси, якщо заданий. */
export function modificationFormSchemaFor(primary: string) {
  return modificationFormSchema.superRefine((v, ctx) => {
    if (!v.names[primary])
      ctx.addIssue({ code: 'custom', path: ['names', primary], message: 'n' });
    for (const [l, slug] of Object.entries(v.tokens))
      if (slug !== '' && !SLUG_RE.test(slug))
        ctx.addIssue({ code: 'custom', path: ['tokens', l], message: 't' });
  });
}
