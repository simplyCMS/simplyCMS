import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import {
  SOCIAL_NETWORKS,
  STORE_PROFILE_LIMITS as LIMITS,
} from 'simplycms/contracts/store-profile';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import type { StoreProfileFormValues } from './settings-form-schema';

type Props = { readonly form: UseFormReturn<StoreProfileFormValues> };

/** Блок «Соцмережі»: рядки «мережа + посилання», до `LIMITS.socials`. */
export function SocialsCard({ form }: Props) {
  const t = useT();
  const { register, control, formState } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'socials',
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.settings.socials.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field, i) => {
          const urlError = formState.errors.socials?.[i]?.url;
          return (
            <div key={field.id} className="space-y-1">
              <div className="flex gap-2">
                {/* Нативний select: сім стабільних значень, без поповера. */}
                <select
                  aria-label={t('admin.settings.socials.network')}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  {...register(`socials.${i}.network`)}
                >
                  {SOCIAL_NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {t(`admin.settings.network.${n}`)}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={t('admin.settings.socials.url')}
                  aria-invalid={!!urlError}
                  placeholder="https://"
                  maxLength={LIMITS.socialUrl}
                  {...register(`socials.${i}.url`)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t('admin.settings.socials.remove')}
                  onClick={() => remove(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {urlError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('admin.settings.socials.urlInvalid')}
                </p>
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= LIMITS.socials}
          onClick={() => append({ network: SOCIAL_NETWORKS[0], url: '' })}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.settings.socials.add')}
        </Button>
      </CardContent>
    </Card>
  );
}
