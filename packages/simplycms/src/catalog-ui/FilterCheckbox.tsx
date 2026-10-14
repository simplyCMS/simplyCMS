import type { ReactNode } from 'react';
import { Checkbox } from 'simplycms/ui/checkbox';

interface FilterCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Чекбокс теми: має пріоритет над `simplycms/ui`. */
  renderCheckbox?: (props: Record<string, unknown>) => ReactNode;
}

/**
 * Чекбокс панелі фільтрів.
 *
 * 🔴 Сирий `<input type="checkbox">` фарбується браузером за `color-scheme`
 * документа, а не за токенами теми: при темній системній схемі
 * (`next-themes` ставить `color-scheme: dark`) на світлій вітрині він
 * виглядав чорним. `Checkbox` з `simplycms/ui` бере `border-primary` /
 * `bg-primary` із CSS-змінних теми. Тема, що має власний чекбокс, віддає
 * його через `renderCheckbox` — контракт: `{ id, checked, onCheckedChange }`.
 */
export function FilterCheckbox({
  id,
  checked,
  onCheckedChange,
  renderCheckbox,
}: FilterCheckboxProps) {
  if (renderCheckbox) {
    return <>{renderCheckbox({ id, checked, onCheckedChange })}</>;
  }
  return (
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
    />
  );
}
