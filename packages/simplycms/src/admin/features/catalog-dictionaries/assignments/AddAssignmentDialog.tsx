import { useState } from 'react';
import type { SectionProperty } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Label } from 'simplycms/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { PROPERTY_TYPE_LABEL } from '../properties/property-form-schema';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly appliesTo: 'product' | 'modification';
  /** Уже відфільтровані `availableProperties` — діалог не фільтрує сам. */
  readonly properties: readonly SectionProperty[];
  readonly onAdd: (propertyId: string) => void;
}

/** Вибір властивості для призначення розділу в обраному режимі. */
export function AddAssignmentDialog({
  open,
  onOpenChange,
  appliesTo,
  properties,
  onAdd,
}: Props) {
  const t = useT();
  const [selected, setSelected] = useState('');

  const change = (next: boolean) => {
    if (!next) setSelected('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              appliesTo === 'product'
                ? 'admin.properties.section.addForProduct'
                : 'admin.properties.section.addForModification',
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-property">
              {t('admin.properties.section.pickProperty')}
            </Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="assignment-property">
                <SelectValue
                  placeholder={t(
                    'admin.properties.section.pickPropertyPlaceholder',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({t(PROPERTY_TYPE_LABEL[p.propertyType])})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {properties.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('admin.properties.section.allAdded')}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => change(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!selected}
              onClick={() => {
                onAdd(selected);
                change(false);
              }}
            >
              {t('common.add')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
