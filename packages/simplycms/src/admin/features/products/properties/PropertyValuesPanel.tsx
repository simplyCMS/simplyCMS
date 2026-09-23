import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import { PropertyInput } from './PropertyInput';
import type { PropertyAppliesTo } from './usePropertySchema';
import { usePropertySchema } from './usePropertySchema';
import type { PropertyValueTarget } from './usePropertyValues';
import { usePropertyValues } from './usePropertyValues';

interface Props {
  readonly target: PropertyValueTarget;
  readonly ownerId: string;
  readonly sectionId: string | null;
  readonly appliesTo: PropertyAppliesTo;
  readonly showCard?: boolean;
}

/**
 * Панель значень властивостей (Task 10, Step 3) — один компонент замість
 * легасі `AllProductProperties`/`ProductPropertyValues`:
 * - простий товар: `target='product', appliesTo='all'`;
 * - товар з модифікаціями: `target='product', appliesTo='product'`;
 * - модифікація: `target='modification', appliesTo='modification'`.
 *
 * Рендериться СИБЛІНГОМ форми картки/діалогу, ПОЗА `<form>` (Е3-18 п.1);
 * кожна зміна — автозбереження (`usePropertyValues`, Е3-11).
 */
export function PropertyValuesPanel({
  target,
  ownerId,
  sectionId,
  appliesTo,
  showCard = true,
}: Props) {
  const t = useT();
  const { rows: schema, isLoading } = usePropertySchema(sectionId, appliesTo);
  const { rowsOf, saveScalar, saveMulti } = usePropertyValues(target, ownerId);

  const title = t(
    target === 'modification'
      ? 'admin.properties.values.titleModification'
      : 'admin.properties.section.productProps',
  );

  let content: ReactNode;
  if (!sectionId) {
    content = (
      <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
        {t('admin.properties.section.pickSection')}
      </p>
    );
  } else if (isLoading) {
    content = (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  } else if (schema.length === 0) {
    content = (
      <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
        {t('admin.properties.section.notConfigured')}
      </p>
    );
  } else {
    content = (
      <div className="grid gap-4">
        {schema.map(({ assignment, property, options }) => (
          <div key={property.id} className="space-y-2">
            <Label
              htmlFor={`prop-${property.id}`}
              className="flex items-center gap-2"
            >
              {property.name}
              {property.isRequired && (
                <span className="text-destructive">*</span>
              )}
              {appliesTo === 'all' && (
                <span className="text-xs text-muted-foreground">
                  (
                  {t(
                    assignment.appliesTo === 'modification'
                      ? 'admin.properties.appliesTo.modification'
                      : 'admin.properties.appliesTo.product',
                  )}
                  )
                </span>
              )}
            </Label>
            <PropertyInput
              property={property}
              options={options}
              rows={rowsOf(property.id)}
              onChange={(v) => saveScalar(property.id, v)}
              onMultiChange={(ids) =>
                saveMulti(
                  property.id,
                  ids,
                  (optionId) =>
                    options.find((o) => o.id === optionId)?.name ?? '',
                )
              }
            />
          </div>
        ))}
      </div>
    );
  }

  if (!showCard) return content;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
