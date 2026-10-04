import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'simplycms/ui/dialog';
import { generateStatusCode, type StatusFormData } from './form-data';

interface Props {
  open: boolean;
  /** Редагування існуючого статусу (інакше — створення). */
  editing: { isDefault: boolean } | null;
  form: StatusFormData;
  setForm: Dispatch<SetStateAction<StatusFormData>>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

/**
 * Діалог створення/редагування статусу замовлення.
 *
 * 🔴 `code` незмінний після створення (Е5-6): у режимі редагування поле
 * лише показується (`disabled`), а patch оновлення його не несе.
 */
export function StatusFormDialog(p: Props) {
  const t = useT();
  const { form, setForm } = p;
  const set = (patch: Partial<StatusFormData>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {p.editing
              ? t('admin.orders.statuses.edit')
              : t('admin.orders.statuses.new')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={p.onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('common.nameRequiredLabel')}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  code: prev.code || generateStatusCode(name),
                }));
              }}
              placeholder={t('admin.orders.statuses.namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">
              {t('admin.orders.statuses.codeRequired')}
            </Label>
            <Input
              id="code"
              value={form.code}
              disabled={!!p.editing}
              onChange={(e) => set({ code: e.target.value })}
              placeholder="processing"
            />
            <p className="text-xs text-muted-foreground">
              {p.editing
                ? t('admin.orders.statuses.codeImmutable')
                : t('admin.orders.statuses.codeHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">{t('common.color')}</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="color"
                value={form.color}
                onChange={(e) => set({ color: e.target.value })}
                className="w-12 h-10 rounded border cursor-pointer"
              />
              <Input
                value={form.color}
                onChange={(e) => set({ color: e.target.value })}
                placeholder="#6B7280"
                className="flex-1"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_default">{t('common.byDefault')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('admin.orders.statuses.autoAssign')}
              </p>
            </div>
            <Switch
              id="is_default"
              checked={form.is_default}
              onCheckedChange={(checked) => set({ is_default: checked })}
              // К3-15: зняти дефолт без призначення нового не можна — нуль
              // дефолтів заборонений доменом.
              disabled={!!p.editing?.isDefault}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={p.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={p.isSubmitting}>
              {p.editing ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
