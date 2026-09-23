import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { Form } from 'simplycms/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { Loader2 } from 'lucide-react';
import { adminErrorKey } from '../../../lib/admin-error';
import {
  modificationFormSchema,
  type ModificationFormValues,
} from './modification-form-schema';
import { ModificationFormFields } from './ModificationFormFields';
import { ModificationDialogSections } from './ModificationDialogSections';

const EMPTY: ModificationFormValues = {
  name: '',
  slug: '',
  sku: '',
  stockStatus: 'in_stock',
  isDefault: false,
  images: [],
};

function toFormValues(mod: ProductModification): ModificationFormValues {
  return {
    name: mod.name,
    slug: mod.slug,
    sku: mod.sku ?? '',
    stockStatus: mod.stockStatus ?? 'in_stock',
    isDefault: mod.isDefault,
    images: mod.images ?? [],
  };
}

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
  /** `null` — нова модифікація (ціни/залишки/властивості — недоступні). */
  readonly mod: ProductModification | null;
  readonly onCreate: (values: ModificationFormValues) => Promise<string>;
  readonly onUpdate: (
    id: string,
    values: ModificationFormValues,
  ) => Promise<void>;
}

/**
 * Форма модифікації (Task 8, Step 3) — розмітка легасі
 * `ProductModifications.tsx` (діалог), react-hook-form + Zod. Конфлікт
 * slug (`product_modifications_product_slug_unique`) — тост
 * `adminErrorKey`, форма лишається відкритою з введеним (Review Focus 1).
 */
export function ModificationDialog({
  open,
  onOpenChange,
  productId,
  mod,
  onCreate,
  onUpdate,
}: Props) {
  const t = useT();
  const form = useForm<ModificationFormValues>({
    resolver: zodResolver(modificationFormSchema),
    defaultValues: mod ? toFormValues(mod) : EMPTY,
  });

  // Ре-ініціалізація полів при відкритті на ІНШУ модифікацію/створення —
  // `useForm` бере `defaultValues` лише при монтуванні діалогу.
  useEffect(() => {
    if (open) form.reset(mod ? toFormValues(mod) : EMPTY);
  }, [open, mod, form]);

  const submit = async (values: ModificationFormValues) => {
    try {
      if (mod) await onUpdate(mod.id, values);
      else await onCreate(values);
      onOpenChange(false);
    } catch (e) {
      const key = adminErrorKey(e);
      toast.error(
        key ? t(key) : `${t('common.error')} ${(e as Error).message}`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mod ? t('admin.products.mods.edit') : t('admin.products.mods.new')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <ModificationFormFields modId={mod?.id ?? null} />
            {mod && (
              <ModificationDialogSections
                productId={productId}
                modificationId={mod.id}
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {mod ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
