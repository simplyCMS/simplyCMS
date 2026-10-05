import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import type { PropertyValueDraft } from './usePropertyValues';
import { useDraftField } from './useDraftField';
import {
  NUMERIC_VALUE_PRECISION,
  NUMERIC_VALUE_SCALE,
  fitsNumeric,
  toPlainDecimal,
} from './number-format';

interface Props {
  readonly id: string;
  readonly value: string | null;
  /** Помилка валідації сервера (Тема 12) — показується під полем. */
  readonly error?: string;
  readonly onChange: (v: PropertyValueDraft) => void;
}

/**
 * Числове поле властивості (`number`/`range`) — Е3-19а: збереження на
 * blur/Enter, НЕ на кожну клавішу (write-back "1.0000" посеред набору
 * "15" переписував би чернетку). Чернетка — `useDraftField`; «чи
 * змінилось» — порівняння простих десяткових рядків, порожнє ↔ null.
 *
 * Тема 12: значення шлеться ПРОСТИМ десятковим рядком (без експоненти:
 * `'1e-7'` → `'0.0000001'`), а більше знаків, ніж `numeric(15, 4)`, клієнт
 * не відправляє взагалі — показує помилку біля поля (сервер відхилив би
 * `invalid_decimal`, мовчазного округлення не допускаємо). Нечислове —
 * лише бордюр.
 */
export function NumberPropertyInput({ id, value, error, onChange }: Props) {
  const t = useT();
  const { draft, setDraft, onFocus, onBlur, onEnter } = useDraftField({
    value,
    isChanged: numChanged,
    onSave: (raw) => {
      if (raw === '') {
        onChange({ value: null, numericValue: null, optionId: null });
        return;
      }
      const s = toPlainDecimal(raw);
      if (s === null || !fitsNumeric(s)) return;
      onChange({ value: s, numericValue: s, optionId: null });
    },
  });
  const plain = draft === '' ? null : toPlainDecimal(draft);
  const notNumber = draft !== '' && plain === null;
  const tooPrecise = plain !== null && !fitsNumeric(plain);
  const message = tooPrecise
    ? t('admin.validation.invalid_decimal', {
        precision: NUMERIC_VALUE_PRECISION,
        scale: NUMERIC_VALUE_SCALE,
      })
    : error;
  const errorId = `${id}-error`;

  return (
    <>
      <Input
        id={id}
        type="number"
        step="any"
        value={draft}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter();
        }}
        onChange={(e) => setDraft(e.target.value)}
        className={notNumber || message ? 'border-destructive' : undefined}
        aria-invalid={notNumber || !!message}
        aria-describedby={message ? errorId : undefined}
        placeholder="0"
      />
      {message && (
        <p id={errorId} className="text-xs text-destructive">
          {message}
        </p>
      )}
    </>
  );
}

function numChanged(draft: string, value: string | null): boolean {
  const next = draft === '' ? null : toPlainDecimal(draft);
  // Нечислове або таке, що не вміщається в колонку, — не зберігати.
  if (draft !== '' && (next === null || !fitsNumeric(next))) return false;
  const cur = value === null || value === '' ? null : toPlainDecimal(value);
  return next !== cur;
}
