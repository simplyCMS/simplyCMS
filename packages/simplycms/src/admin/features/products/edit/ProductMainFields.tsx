import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { PathField } from '../../translations/PathField';
import { TranslationStatusBadge } from '../../translations/TranslationStatusBadge';
import {
  fieldStatusOf,
  useTranslationContext,
} from '../../translations/translation-context';
import { useProductCard } from './product-card-context';
import { ProductImagesCard } from './ProductImagesCard';
import type { ProductFormValues } from './product-form-schema';

interface Props {
  readonly mode: 'create' | 'edit';
}

/**
 * Назва/адреса/опис активної мови та фото товару. Статус поля відносно
 * джерела (`outdated`/`missing`) показано біля підпису. Адреса: при створенні —
 * звичайне поле основної мови, при редагуванні — `PathField` зі своєю командою.
 */
export function ProductMainFields({ mode }: Props) {
  const t = useT();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const ctx = useTranslationContext();
  const card = useProductCard();
  const l = ctx.active;
  const nameError = errors.texts?.[l]?.name;
  const language = ctx.languages.find((x) => x.code === l);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('common.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name" className="flex items-center gap-2">
                {l === ctx.primary
                  ? t('common.nameRequiredLabel')
                  : t('common.name')}
                <TranslationStatusBadge
                  status={fieldStatusOf(ctx, l, 'name')}
                />
              </Label>
              <Input
                id="product-name"
                {...register(`texts.${l}.name`)}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'product-name-error' : undefined}
              />
              {nameError && (
                <p
                  id="product-name-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {nameError.type === 'server'
                    ? nameError.message
                    : t('admin.products.nameError')}
                </p>
              )}
            </div>
            {mode === 'create' ? (
              l === ctx.primary && (
                <div className="space-y-2">
                  <Label htmlFor="product-slug">
                    {t('admin.products.slugLabel')}
                  </Label>
                  <Input
                    id="product-slug"
                    {...register('path')}
                    aria-invalid={!!errors.path}
                    aria-describedby="product-slug-error"
                  />
                  <p
                    id="product-slug-error"
                    role={errors.path ? 'alert' : undefined}
                    className={
                      errors.path
                        ? 'text-xs text-destructive'
                        : 'text-xs text-muted-foreground'
                    }
                  >
                    {errors.path?.type === 'server'
                      ? errors.path.message
                      : t('admin.products.slugHint')}
                  </p>
                </div>
              )
            ) : (
              <PathField
                key={l}
                productId={card.productId!}
                locale={l}
                languageName={language?.name ?? l}
                path={card.paths[l]}
                onConflict={card.onConflict}
                onSaved={(p) => card.onPathSaved(l, p)}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="product-short-description"
              className="flex items-center gap-2"
            >
              {t('admin.products.shortDescription')}
              <TranslationStatusBadge
                status={fieldStatusOf(ctx, l, 'shortDescription')}
              />
            </Label>
            <Input
              id="product-short-description"
              {...register(`texts.${l}.shortDescription`)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {t('admin.products.fullDescription')}
              <TranslationStatusBadge
                status={fieldStatusOf(ctx, l, 'description')}
              />
            </Label>
            <RichTextEditor
              key={l}
              content={watch(`texts.${l}.description`) ?? ''}
              onChange={(content) =>
                setValue(`texts.${l}.description`, content, {
                  shouldDirty: true,
                })
              }
              placeholder={t('admin.products.descriptionPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      <ProductImagesCard />
    </>
  );
}
