import { useState } from 'react';
import { toast } from 'sonner';
import { setProductPath } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { adminErrorKey } from '../../lib/admin-error';
import { applyServerValidation } from '../../lib/apply-server-validation';
import { useAggregateCommand } from './useAggregateCommand';

interface Props {
  readonly productId: string;
  readonly locale: string;
  /** Назва мови для підпису. */
  readonly languageName: string;
  /** Збережена адреса мови (`products.get`.paths); немає — ще не створена. */
  readonly path: string | undefined;
  readonly onConflict: (currentVersion: number) => void;
  /** Адресу збережено: картка оновлює свій знімок `paths`. */
  readonly onSaved?: (path: string) => void;
}

/**
 * Адреса товару однієї мови. Редагується ОКРЕМО від тексту (І17: адреса не
 * виводиться з назви після створення) власною командою `products.setPath`,
 * тож не тягне за собою решту незбережених полів картки.
 */
export function PathField({
  productId,
  locale,
  languageName,
  path,
  onConflict,
  onSaved,
}: Props) {
  const t = useT();
  const [value, setValue] = useState(path ?? '');
  const [saved, setSaved] = useState(path ?? '');
  const [error, setError] = useState<string | null>(null);
  const { run, isPending } = useAggregateCommand(setProductPath, {
    onConflict,
  });
  const id = `product-path-${locale}`;

  const save = async () => {
    setError(null);
    try {
      const out = await run({ id: productId, locale, path: value.trim() });
      if (!out) return;
      setSaved(value.trim());
      onSaved?.(value.trim());
      toast.success(t('admin.translations.path.saved'));
    } catch (e) {
      const rest = applyServerValidation(
        e,
        (_f, err) => setError(err.message),
        {
          t,
          fieldFor: (p) => (p[0] === 'path' ? 'path' : null),
        },
      );
      if (rest === null) {
        const key = adminErrorKey(e);
        toast.error(
          key ? t(key) : `${t('common.error')} ${(e as Error).message}`,
        );
      } else if (rest.length > 0) toast.error(t('admin.validation.failed'));
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {t('admin.translations.path.label', { language: languageName })}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error !== null}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending || value.trim() === saved || value.trim() === ''}
          onClick={save}
        >
          {t('admin.translations.path.save')}
        </Button>
      </div>
      <p
        role={error ? 'alert' : undefined}
        className={
          error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
        }
      >
        {error ?? t('admin.products.slugHint')}
      </p>
    </div>
  );
}
