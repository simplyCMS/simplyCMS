import { z } from 'zod';
import { PROPERTY_KINDS } from './children-schemas';
import {
  fieldStatus as statusEnum,
  stockStatus as statusStock,
} from './schemas';

// Форма дітей агрегата у відповіді `products.get`: дзеркало входу `saveDescription`
// (ті самі id та мапи за мовою) + статуси, як у `textsRow` (М1, Task 12).

const status = statusEnum;
const perLocale = <T extends z.ZodType>(row: T) => z.record(z.string(), row);

export const childrenOut = z.object({
  modifications: z.array(
    z.object({
      id: z.uuid(),
      sku: z.string().nullable(),
      isDefault: z.boolean(),
      sortOrder: z.number().int(),
      stockStatus: statusStock,
      texts: perLocale(
        z.object({
          name: z.string().nullable(),
          status,
          fieldStatus: z.record(z.string(), status),
        }),
      ),
      /** Лише поточні токени за мовою. */
      token: z.record(z.string(), z.string()),
    }),
  ),
  propertyValues: z.array(
    z.object({
      id: z.uuid(),
      propertyId: z.uuid(),
      kind: z.enum(PROPERTY_KINDS),
      optionId: z.uuid().optional(),
      number: z.string().optional(),
      bool: z.boolean().optional(),
      color: z.string().optional(),
      modificationId: z.uuid().optional(),
      text: z.record(z.string(), z.string().nullable()).optional(),
      /** Статуси поруч із полем (конвенція `textsRow`): мова -> статус. */
      textStatus: z.record(z.string(), status).optional(),
    }),
  ),
  images: z.array(
    z.object({
      id: z.uuid(),
      storageKey: z.string(),
      sortOrder: z.number().int(),
      modificationId: z.uuid().optional(),
      alt: perLocale(z.string().nullable()),
      overrides: perLocale(z.string()),
    }),
  ),
});
export type ChildrenOut = z.infer<typeof childrenOut>;
