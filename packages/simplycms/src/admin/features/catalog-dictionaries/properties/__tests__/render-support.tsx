import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import type {
  PropertyOption,
  SectionProperty,
  SectionPropertyAssignment,
} from 'simplycms/schema/types';

/** Ідентифікатори фікстур — валідні uuid, як у реальних рядках. */
export const ID = {
  brand: 'c0000000-0000-4000-8000-000000000001',
  weight: 'c0000000-0000-4000-8000-000000000002',
  color: 'c0000000-0000-4000-8000-000000000003',
  samsung: 'd0000000-0000-4000-8000-000000000001',
  apple: 'd0000000-0000-4000-8000-000000000002',
  section: 'b0000000-0000-4000-8000-000000000001',
  otherSection: 'b0000000-0000-4000-8000-000000000002',
  assignBrand: 'e0000000-0000-4000-8000-000000000001',
  assignForeign: 'e0000000-0000-4000-8000-000000000002',
} as const;

const prop = (p: Partial<SectionProperty>): SectionProperty => ({
  id: ID.brand,
  sectionId: null,
  name: 'Бренд',
  slug: 'brand',
  propertyType: 'select',
  isRequired: false,
  isFilterable: true,
  hasPage: true,
  sortOrder: 0,
  options: null,
  createdAt: new Date('2026-10-03'),
  ...p,
});

export const PROPS: SectionProperty[] = [
  prop({}),
  prop({
    id: ID.weight,
    name: 'Вага',
    slug: 'weight',
    propertyType: 'number',
    isFilterable: false,
    hasPage: false,
    sortOrder: 1,
  }),
  prop({
    id: ID.color,
    name: 'Колір',
    slug: 'color',
    propertyType: 'multiselect',
    sortOrder: 2,
  }),
];

const opt = (o: Partial<PropertyOption>): PropertyOption => ({
  id: ID.samsung,
  propertyId: ID.brand,
  name: 'Samsung',
  slug: 'samsung',
  sortOrder: 0,
  createdAt: new Date('2026-10-03'),
  description: null,
  imageUrl: null,
  metaTitle: null,
  metaDescription: null,
  ...o,
});

export const OPTIONS: PropertyOption[] = [
  opt({ imageUrl: 'property_option/x/samsung.png' }),
  opt({ id: ID.apple, name: 'Apple', slug: 'apple', sortOrder: 1 }),
];

const assign = (a: Partial<SectionPropertyAssignment>) =>
  ({
    id: ID.assignBrand,
    sectionId: ID.section,
    propertyId: ID.brand,
    sortOrder: 0,
    createdAt: new Date('2026-10-03'),
    appliesTo: 'product',
    ...a,
  }) satisfies SectionPropertyAssignment;

export const ASSIGNMENTS: SectionPropertyAssignment[] = [
  assign({}),
  // Призначення ІНШОГО розділу — зріз `where sectionId` мусить його відсіяти.
  assign({
    id: ID.assignForeign,
    sectionId: ID.otherSection,
    propertyId: ID.weight,
    appliesTo: 'modification',
  }),
];

type Filter = { field: string[]; operator: string; value: unknown };
type Payload = { subset?: { filters?: Filter[] } };

/**
 * «Сервер» list-serverFn за контрактом `impl/subset.ts` (eq/in): ФІЛЬТРУЄ
 * рядки за переданим subset, а не віддає все — інакше зріз `where` на
 * сторінці був би неперевірним (той самий принцип, що
 * `admin-data/__tests__/on-demand-full-slice.test.tsx`).
 */
export function serve<T extends object>(rows: readonly T[]) {
  return async ({ data }: { data?: Payload }) =>
    rows.filter((r) =>
      (data?.subset?.filters ?? []).every((f) => {
        const v = (r as Record<string, unknown>)[f.field.join('.')];
        if (f.operator === 'eq') return v === f.value;
        if (f.operator === 'in') return (f.value as unknown[]).includes(v);
        throw new Error(`стаб: оператор ${f.operator} поза контрактом`);
      }),
    );
}

/** Insert/update-стаби повертають рядок «як сервер» — для write-back. */
export const echoInsert = async ({ data }: { data: unknown[] }) => data;

export function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}
