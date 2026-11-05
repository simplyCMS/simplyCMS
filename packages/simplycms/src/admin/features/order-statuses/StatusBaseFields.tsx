import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import type { StatusBaseForm } from './form-data';

interface Props {
  readonly idBase: string;
  readonly base: StatusBaseForm;
  readonly set: (patch: Partial<StatusBaseForm>) => void;
  /** Редагований статус (код незмінний, дефолт не знімається); `null` — створення. */
  readonly editing: { isDefault: boolean } | null;
}

/** Неперекладні поля статусу: код, колір, дефолт. */
export function StatusBaseFields({ idBase, base, set, editing }: Props) {
  const t = useT();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-code`}>
          {t('admin.orders.statuses.codeRequired')}
        </Label>
        <Input
          id={`${idBase}-code`}
          value={base.code}
          disabled={!!editing}
          onChange={(e) => set({ code: e.target.value })}
          placeholder="processing"
        />
        <p className="text-xs text-muted-foreground">
          {editing
            ? t('admin.orders.statuses.codeImmutable')
            : t('admin.orders.statuses.codeHint')}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-color`}>{t('common.color')}</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            id={`${idBase}-color`}
            value={base.color}
            onChange={(e) => set({ color: e.target.value })}
            className="w-12 h-10 rounded border cursor-pointer"
          />
          <Input
            value={base.color}
            onChange={(e) => set({ color: e.target.value })}
            placeholder="#6B7280"
            className="flex-1"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor={`${idBase}-default`}>{t('common.byDefault')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('admin.orders.statuses.autoAssign')}
          </p>
        </div>
        <Switch
          id={`${idBase}-default`}
          checked={base.isDefault}
          onCheckedChange={(checked) => set({ isDefault: checked })}
          // К3-15: зняти дефолт без призначення нового не можна — нуль дефолтів заборонений.
          disabled={!!editing?.isDefault}
        />
      </div>
    </>
  );
}
