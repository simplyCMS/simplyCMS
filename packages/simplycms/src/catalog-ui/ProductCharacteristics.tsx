import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { isSafeCssColor } from 'simplycms/domain';

interface PropertyValue {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id?: string | null;
  value_lang?: string | null;
  option?: {
    id: string;
    slug: string;
    name: string;
  } | null;
  property?: {
    id: string;
    name: string;
    slug: string;
    property_type: string;
    has_page?: boolean;
  } | null;
}

/**
 * Колір для плашки: значення йде в `style`, тож лише безпечний CSS-колір (з `#` або
 * без нього — URL-форма токена кольору пише hex без `#`); інакше плашки немає.
 */
function swatchColor(value: string | null): string | null {
  if (!value) return null;
  if (isSafeCssColor(value)) return value;
  return isSafeCssColor(`#${value}`) ? `#${value}` : null;
}

interface ProductCharacteristicsProps {
  propertyValues: PropertyValue[];
}

export function ProductCharacteristics({
  propertyValues,
}: ProductCharacteristicsProps) {
  const t = useT();
  const displayableValues = propertyValues.filter(
    (pv) => pv.property && (pv.value || pv.numeric_value !== null || pv.option),
  );

  if (displayableValues.length === 0) {
    return null;
  }

  // Значення — за ТИПОМ властивості (Р18): булеве і колір лишаються текстами
  // `'true'`/`'false'` і `#rrggbb`, які лоадер кладе у `value` за `value_kind`.
  // 🔴 Назва опції — з `option.name` (join `property_options`, завжди
  // свіжий), НЕ з `pv.value`: для рядків з опцією `value` — застарілий
  // кеш, що розходиться при перейменуванні опції (Е3-13, ревізія).
  const formatValue = (pv: PropertyValue): string => {
    if (pv.property?.property_type === 'boolean') {
      return pv.value === 'true' ? t('common.yes') : t('common.no');
    }
    if (pv.option) {
      return pv.option.name;
    }
    if (pv.numeric_value !== null) {
      return String(pv.numeric_value);
    }
    return pv.value || '—';
  };

  const renderValue = (pv: PropertyValue) => {
    const formattedValue = formatValue(pv);

    const swatch =
      pv.property?.property_type === 'color' ? swatchColor(pv.value) : null;
    if (swatch) {
      return (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border"
            style={{ backgroundColor: swatch }}
          />
          {formattedValue}
        </span>
      );
    }

    if (pv.property?.has_page && pv.option?.slug && pv.property?.slug) {
      return (
        <Link
          to="/properties/$propertySlug/$optionSlug"
          params={{
            propertySlug: pv.property.slug,
            optionSlug: pv.option.slug,
          }}
          className="text-primary hover:underline"
        >
          {formattedValue}
        </Link>
      );
    }

    return pv.value_lang && !pv.option ? (
      <span lang={pv.value_lang}>{formattedValue}</span>
    ) : (
      formattedValue
    );
  };

  return (
    <dl className="divide-y">
      {displayableValues.map((pv) => (
        <div
          key={pv.property_id}
          className="flex justify-between py-3 first:pt-0 last:pb-0"
        >
          <dt className="text-muted-foreground">{pv.property?.name}</dt>
          <dd className="font-medium text-right">{renderValue(pv)}</dd>
        </div>
      ))}
    </dl>
  );
}
