import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly registration: UseFormRegisterReturn;
  readonly invalid?: boolean;
  readonly placeholder?: string;
  /** Текст помилки — рендериться як `role="alert"`, лише коли `invalid`. */
  readonly errorText?: string;
  readonly maxLength?: number;
}

/** Текстове поле форми довідника з лейблом і (опційно) помилкою. */
export function TextField({
  id,
  label,
  registration,
  invalid = false,
  placeholder,
  errorText,
  maxLength,
}: TextFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={invalid}
        {...registration}
      />
      {invalid && errorText && (
        <p role="alert" className="text-xs text-destructive">
          {errorText}
        </p>
      )}
    </div>
  );
}

interface SlugFieldProps {
  readonly id: string;
  readonly label: string;
  readonly registration: UseFormRegisterReturn;
  readonly invalid: boolean;
  /** Підказка формату; при помилці стає `role="alert"`. */
  readonly hint: string;
}

/** Поле slug: підказка формату звʼязана `aria-describedby` і червоніє на помилці. */
export function SlugField({
  id,
  label,
  registration,
  invalid,
  hint,
}: SlugFieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={invalid}
        aria-describedby={hintId}
        {...registration}
      />
      <p
        id={hintId}
        role={invalid ? 'alert' : undefined}
        className={
          invalid ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
        }
      >
        {hint}
      </p>
    </div>
  );
}

/** Числове поле порядку сортування. */
export function SortOrderField({
  id,
  label,
  registration,
  invalid,
  className,
}: {
  readonly id: string;
  readonly label: string;
  readonly registration: UseFormRegisterReturn;
  readonly invalid: boolean;
  readonly className?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        className={className}
        aria-invalid={invalid}
        {...registration}
      />
    </div>
  );
}
