import type { ReactNode } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { Button } from 'simplycms/ui/button';
import { Form } from 'simplycms/ui/form';
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
  /**
   * Панелі-сателіти (`ProductEditPage`) — рендеряться ПІСЛЯ `</form>`, але
   * всередині ТОГО САМОГО `FormProvider` (`<Form {...form}>`), тож
   * `SimpleProductPanel`'s `useFormContext()` (поле `sku`) і далі бачить
   * форму картки. `FormProvider` — чистий React-контекст, без власного DOM-
   * вузла: «всередині Form» ≠ «нащадок `<form>`» (структурний фікс лишається
   * чинним — жодна панель не є нащадком літерального `<form>`).
   */
  readonly children?: ReactNode;
}

/**
 * Композиція форми картки товару (Task 7): розмітка й `PluginSlot`-и — з
 * легасі `ProductEdit.tsx` БЕЗ дизайнерських змін, шар даних —
 * react-hook-form + Zod (`FormProvider`, підполя читають контекст).
 *
 * 🔴 Рев'ю хвилі C (BLOCKER, структурний фікс): панелі-сателіти
 * (модифікації/ціни/залишки, Task 8) — НЕ тут. `Button` ядра не задає
 * `type` ⇒ усередині `<form>` це `submit`; панель, змонтована як нащадок
 * цього `<form>`, сабмітила б картку кожним своїм кліком («Зберегти
 * залишки», ↑/↓ модифікації тощо). Тож `<form>` тут несе ЛИШЕ поля картки
 * (`ProductMainFields`/`ProductSeoFields`/сайдбар) — панелі рендерить
 * `ProductEditPage` СИБЛІНГОМ цього компонента, за ЖИВИМ рядком колекції
 * (Task 7 Step 3 — не за `useWatch` незбереженої форми: інакше перемикач
 * типу товару підміняв би панель ДО Save, а панель писала б у таблицю, де
 * БД ще каже `has_modifications` протилежне).
 */
export function ProductForm({
  productId,
  defaultValues,
  onSubmit,
  submitLabel,
  meta,
  children,
}: Props) {
  const t = useT();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          (values) => onSubmit(values),
          () => toast.error(t('admin.products.fixFields')),
        )}
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
      {children}
    </Form>
  );
}
