import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { ProductForm } from './ProductForm';
import { blankForm } from './product-aggregate';
import {
  productFormSchemaFor,
  type ProductFormValues,
} from './product-form-schema';
import { useProductLanguages } from './useProductAggregate';
import { useProductCreate } from './useProductSave';
import { useRowErrors } from './useRowErrors';
import type { LanguageInfo } from '../../translations/translation-context';

interface BodyProps {
  readonly languages: readonly LanguageInfo[];
}

function Body({ languages }: BodyProps) {
  const t = useT();
  const primary =
    languages.find((l) => l.isDefault)?.code ?? languages[0]!.code;
  // К3-Е6д-1: id нового товару наперед — фото привʼязуються до нього ще до
  // збереження, і той самий id йде в `products.create`.
  const [newId] = useState(() => crypto.randomUUID());
  const rows = useRowErrors();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchemaFor(primary)),
    defaultValues: blankForm(languages.map((l) => l.code)),
  });
  const create = useProductCreate(newId, {
    setFormError: (name, message) =>
      form.setError(name as never, { type: 'server', message }),
    setModificationError: rows.setModificationError,
    setValueError: rows.setValueError,
  });

  return (
    <ProductForm
      form={form}
      mode="create"
      translation={{ languages, primary, statuses: {} }}
      card={{
        productId: null,
        entityId: newId,
        paths: {},
        persistedModificationIds: new Set(),
        modificationErrors: {},
        valueErrors: {},
        clearValueError: () => undefined,
        onConflict: () => undefined,
      }}
      onSubmit={create}
      submitLabel={t('common.create')}
    >
      <PluginSlot
        name="admin.product.form.after"
        context={{ productId: null }}
      />
    </ProductForm>
  );
}

/**
 * Сторінка нового товару: лише поля картки (тексти за мовами, адреса основної
 * мови, фото) — модифікації, ціни, залишки й властивості з'являються після
 * створення, бо писати їх ще немає в що.
 */
export function NewProductPage() {
  const t = useT();
  const langs = useProductLanguages();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.products.new')}</h1>
        <p className="text-muted-foreground">
          {t('admin.products.newSubtitle')}
        </p>
      </div>
      {langs.data && langs.data.length > 0 ? (
        <Body languages={langs.data} />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin" />
      )}
    </div>
  );
}
