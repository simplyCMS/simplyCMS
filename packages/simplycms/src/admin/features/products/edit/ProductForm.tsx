import { Loader2, Save } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { Button } from 'simplycms/ui/button';
import { Form } from 'simplycms/ui/form';
import { ModificationsPanel } from '../modifications/ModificationsPanel';
import { SimpleProductPanel } from '../simple/SimpleProductPanel';
import { ProductMainFields } from './ProductMainFields';
import { ProductMetaCard } from './ProductMetaCard';
import { ProductSeoFields } from './ProductSeoFields';
import { ProductSidebar } from './ProductSidebar';
import {
  productFormSchema,
  type ProductFormValues,
} from './product-form-schema';

interface Props {
  /** `null` — новий товар (не створено, ID немає). */
  readonly productId: string | null;
  readonly defaultValues: ProductFormValues;
  readonly onSubmit: (values: ProductFormValues) => void | Promise<void>;
  readonly submitLabel: string;
  /** Дати для `ProductMetaCard` — лише для ІСНУЮЧОГО товару. */
  readonly meta?: { createdAt: Date; updatedAt: Date };
}

/**
 * Композиція форми картки товару (Task 7): розмітка й `PluginSlot`-и — з
 * легасі `ProductEdit.tsx` БЕЗ дизайнерських змін, шар даних —
 * react-hook-form + Zod (`FormProvider`, підполя читають контекст).
 *
 * 🔴 Task 8 (відхилення від файлового списку плану — там панелі-сателіти
 * малює `ProductEditPage.tsx` «рядком нижче форми»): `sku`/`stockStatus`
 * простого товару вже живуть у ЦІЙ формі (`product-form-schema.ts`,
 * `useProductSave.test.tsx` кейс (в) — Task 7), а не в окремому стані.
 * Панель, змонтована ПОЗА `<Form>`, писала б ті самі поля ДРУГИМ шляхом —
 * наступний клік «Зберегти» переніс би в БД стейл `defaultValues` з
 * моменту відкриття картки (RHF не стежить за зовнішніми пропсами). Тож
 * `SimpleProductPanel` читає/пише `sku`/`stockStatus` через
 * `useFormContext` — ОДНЕ джерело правди, один Save. Модифікації —
 * окрема таблиця, тож `ModificationsPanel` пише свою колекцію напряму,
 * без звʼязку з цим `<form>`.
 */
export function ProductForm({
  productId,
  defaultValues,
  onSubmit,
  submitLabel,
  meta,
}: Props) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });
  // 🔴 Task 8: панелі-сателіти (модифікації/ціни/залишки) потребують
  // hasModifications ЖИВИМ, не одноразовим defaultValues — перемикач типу
  // товару в `ProductSidebar` мусить одразу підмінити панель без Save.
  const hasModifications = useWatch({
    control: form.control,
    name: 'hasModifications',
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        className="space-y-6"
      >
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {submitLabel}
          </Button>
        </div>

        <PluginSlot name="admin.product.form.before" context={{ productId }} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProductMainFields productId={productId} />
            <ProductSeoFields />
            <PluginSlot
              name="admin.product.form.fields"
              context={{ productId }}
            />
            {/* Task 8: панелі-сателіти — лише для ІСНУЮЧОГО товару (як
                легасі `!isNew && …`), товару без id писати нема куди. */}
            {productId &&
              (hasModifications ? (
                <ModificationsPanel productId={productId} />
              ) : (
                <SimpleProductPanel productId={productId} />
              ))}
            <PluginSlot
              name="admin.product.form.after"
              context={{ productId }}
            />
          </div>

          <div className="space-y-6">
            <ProductSidebar />
            <PluginSlot
              name="admin.product.form.sidebar"
              context={{ productId }}
            />
            {productId && meta && (
              <ProductMetaCard
                id={productId}
                createdAt={meta.createdAt}
                updatedAt={meta.updatedAt}
              />
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
