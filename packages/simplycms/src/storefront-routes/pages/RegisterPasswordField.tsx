import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';

/** Поле пароля з перемикачем видимості: пароль і його підтвердження — один вигляд. */
export function RegisterPasswordField({
  id,
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          placeholder="--------"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`pl-10 pr-10 ${error ? 'border-destructive' : ''}`}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
