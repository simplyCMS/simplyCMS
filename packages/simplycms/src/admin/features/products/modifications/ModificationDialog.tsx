import { useEffect } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Form } from 'simplycms/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { useProductCard } from '../edit/product-card-context';
import type { ProductFormValues } from '../edit/product-form-schema';
import { useTranslationContext } from '../../translations/translation-context';
import {
  modificationFormSchemaFor,
  type ModificationFormValues,
} from './modification-form-schema';
import { ModificationFormFields } from './ModificationFormFields';
import { ModificationDialogSections } from './ModificationDialogSections';
import { resolveModFormValues } from './modification-form-values';
import type { DraftModification } from '../edit/product-form-schema';

const DIALOG_FORM_ID = 'modification-dialog-form';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
  /** Розділ товару — для секції властивостей `ModificationDialogSections`. */
  readonly sectionId: string | null;
  /** `null` — нова модифікація. */
  readonly mod: DraftModification | null;
  /** id нової модифікації, згенерований наперед. */
  readonly newId: string;
  /** Застосувати значення до чернетки картки (мережі тут немає). */
  readonly onApply: (id: string, values: ModificationFormValues) => void;
}

/**
 * Форма модифікації: react-hook-form + Zod. «Застосувати» змінює чернетку
 * картки, а не БД.
 *
 * 🔴 Структура: `<form>` несе ЛИШЕ поля модифікації — секції цін/залишків/
 * властивостей ПОЗА нею (їхні кнопки не мусять сабмітити діалог), а кнопки
 * внизу сабмітять форму через HTML5 `form={DIALOG_FORM_ID}`. Секції доступні
 * лише для модифікації, що вже є в БД: ціни й залишки писати ще нікуди.
 */
export function ModificationDialog({
  open,
  onOpenChange,
  productId,
  sectionId,
  mod,
  newId,
  onApply,
}: Props) {
  const t = useT();
  const { languages, primary } = useTranslationContext();
  const card = useProductCard();
  const parent = useFormContext<ProductFormValues>();
  const codes = languages.map((l) => l.code);
  const form = useForm<ModificationFormValues>({
    resolver: zodResolver(modificationFormSchemaFor(primary)),
    defaultValues: resolveModFormValues(mod, parent.getValues('images'), codes),
  });

  // `useForm` бере `defaultValues` лише при монтуванні: при відкритті на ІНШУ
  // модифікацію чи створення поля ініціалізуємо наново.
  useEffect(() => {
    if (open)
      form.reset(resolveModFormValues(mod, parent.getValues('images'), codes));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- перелік мов стабільний протягом відкриття
  }, [open, mod, form]);

  const submit = (values: ModificationFormValues) => {
    onApply(mod?.id ?? newId, values);
    onOpenChange(false);
  };
  const persisted = mod !== null && card.persistedModificationIds.has(mod.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mod ? t('admin.products.mods.edit') : t('admin.products.mods.new')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id={DIALOG_FORM_ID}
            onSubmit={(e) => {
              // Вкладена форма в порталі не мусить сабмітити картку-предка.
              e.stopPropagation();
              return form.handleSubmit(submit, () =>
                toast.error(t('admin.products.fixFields')),
              )(e);
            }}
            className="space-y-4"
          >
            <ModificationFormFields
              productId={productId}
              modId={mod?.id ?? newId}
            />
          </form>

          {persisted && mod && (
            <ModificationDialogSections
              productId={productId}
              modificationId={mod.id}
              sectionId={sectionId}
            />
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" form={DIALOG_FORM_ID}>
              {t('admin.products.mods.apply')}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
