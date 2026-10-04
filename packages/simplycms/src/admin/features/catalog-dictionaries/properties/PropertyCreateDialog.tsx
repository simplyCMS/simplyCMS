import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  sectionPropertiesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { reportTxError } from '../../../lib/report-tx-error';
import { PropertyFields } from './PropertyFields';
import {
  EMPTY_PROPERTY,
  propertyFormSchema,
  toPropertyDraft,
  type PropertyFormInput,
  type PropertyFormValues,
} from './property-form-schema';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Створення властивості — діалог, як у легасі, але на react-hook-form +
 * `propertyFormSchema`. id генерує клієнт (контракт id, Е0). При відмові
 * сервера (дубль slug) діалог лишається з введеним — тост пояснює.
 */
export function PropertyCreateDialog({ open, onOpenChange }: Props) {
  const t = useT();
  const collection = useCollection(sectionPropertiesCollection);
  const form = useForm<PropertyFormInput, unknown, PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: EMPTY_PROPERTY,
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const close = (next: boolean) => {
    if (!next) reset(EMPTY_PROPERTY);
    onOpenChange(next);
  };

  const onSubmit = async (v: PropertyFormValues) => {
    const tx = collection.insert(
      toPropertyDraft(v, crypto.randomUUID(), new Date()),
    );
    try {
      await tx.isPersisted.promise;
    } catch (e) {
      reportTxError(t, e);
      return;
    }
    toast.success(t('admin.properties.created'));
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin.properties.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <PropertyFields form={form} idPrefix="property-new" typeEditable />
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
