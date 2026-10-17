import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { Button } from 'simplycms/ui/button';
import { Form } from 'simplycms/ui/form';
import { LanguageTabs } from '../../translations/LanguageTabs';
import {
  TranslationContext,
  type TranslationContextValue,
} from '../../translations/translation-context';
import { ProductMainFields } from './ProductMainFields';
import { ProductMetaCard } from './ProductMetaCard';
import { ProductSeoFields } from './ProductSeoFields';
import { ProductSidebar } from './ProductSidebar';
import {
  ProductCardContext,
  type ProductCardContextValue,
} from './product-card-context';
import type { ProductFormValues } from './product-form-schema';

interface Props {
  readonly form: UseFormReturn<ProductFormValues>;
  readonly mode: 'create' | 'edit';
  readonly card: ProductCardContextValue;
  /** Активну мову тримає власник (картка/сторінка створення): помилку сервера перемикає вкладку. */
  readonly translation: TranslationContextValue;
  readonly errorLocales?: ReadonlySet<string>;
  /** Клієнтська (zod) помилка полів мов: власник позначає вкладки й перемикається на першу. */
  readonly onInvalidLocales?: (locales: string[]) => void;
  readonly onSubmit: (values: ProductFormValues) => void | Promise<void>;
  readonly submitLabel: string;
  /**
   * Панелі-сателіти (модифікації, ціни, залишки, властивості) — ПІСЛЯ
   * `</form>`, але всередині того ж `FormProvider`: `Button` ядра без `type`
   * усередині `<form>` сабмітив би картку кожним своїм кліком, а читати
   * чернетку картки (модифікації, значення) їм треба.
   */
  readonly children?: ReactNode;
}

/**
 * Композиція картки товару: вкладки мов зверху, поля активної мови, бокова
 * панель, єдина кнопка «Зберегти». Дані й збереження — у `ProductCard` /
 * `NewProductPage` (тут лише розмітка й контексти).
 */
export function ProductForm({
  form,
  mode,
  card,
  translation,
  errorLocales,
  onInvalidLocales,
  onSubmit,
  submitLabel,
  children,
}: Props) {
  const t = useT();
  const { active, setActive } = translation;
  const productId = card.productId;

  return (
    <TranslationContext.Provider value={translation}>
      <ProductCardContext.Provider value={card}>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              (values) => onSubmit(values),
              (errors) => {
                onInvalidLocales?.(Object.keys(errors.texts ?? {}));
                toast.error(t('admin.products.fixFields'));
              },
            )}
            className="space-y-6"
          >
            <div className="flex items-center justify-between gap-4">
              <LanguageTabs
                languages={translation.languages}
                active={active}
                onChange={setActive}
                errorLocales={errorLocales}
                statusOf={(code) =>
                  translation.statuses[code]?.status ?? 'missing'
                }
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {submitLabel}
              </Button>
            </div>

            <PluginSlot
              name="admin.product.form.before"
              context={{ productId }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProductMainFields mode={mode} />
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
                {productId && <ProductMetaCard id={productId} />}
              </div>
            </div>
          </form>
          {children}
        </Form>
      </ProductCardContext.Provider>
    </TranslationContext.Provider>
  );
}
