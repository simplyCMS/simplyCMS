import { Check } from 'lucide-react';
import type {
  ProductDetailCharacteristics,
  ProductPropertyValueViewModel,
} from '@simplycms/objects/views';
import { useT } from '@simplycms/i18n';

/** Значення характеристики рядком — та сама логіка, що в каноні ядра. */
function formatValue(
  item: ProductPropertyValueViewModel,
  yes: string,
  no: string,
): string {
  if (item.property?.property_type === 'boolean') {
    return item.value === 'true' ? yes : no;
  }
  if (item.numeric_value !== null) return String(item.numeric_value);
  return item.value ?? '';
}

/**
 * Чек-лист під коротким описом: три перші характеристики товару.
 *
 * 🔴 Рішення прогону №4 (спека §7): у референсі тут три «переваги» товару, а
 * поля «переваги» у `ProductDetailViewModel` немає. Вигаданий текст став би
 * обіцянкою від імені магазину, якої дані не підтверджують, тому блок
 * наповнюють РЕАЛЬНІ характеристики того самого товару. Формат і кола-галочки
 * — вимір референсу (коло 20px `bg-black/80`, галочка 12px біла, `gap 10px`).
 */
export function ProductHighlights({
  characteristics,
}: {
  characteristics: ProductDetailCharacteristics;
}) {
  const t = useT();
  const yes = t('common.yes');
  const no = t('common.no');

  const items = characteristics.items
    .filter(
      (item) => item.property && (item.value || item.numeric_value !== null),
    )
    .slice(0, 3);

  if (items.length === 0) return null;

  return (
    <div className="mt-6 space-y-2.5">
      {items.map((item) => (
        <div key={item.property_id} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </span>
          <span className="text-sm leading-relaxed text-foreground">
            {item.property?.name}: {formatValue(item, yes, no)}
          </span>
        </div>
      ))}
    </div>
  );
}
