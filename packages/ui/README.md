# @simplycms/ui

Дизайн-система SimplyCMS: 48 компонентів shadcn/ui на Radix-примітивах і
Tailwind v4. Кожен компонент — окремий subpath-експорт; пакет self-contained.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/ui
```

## Що всередині

| Імпорт                      | Що дає                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| `@simplycms/ui/<компонент>` | Один компонент: `button`, `card`, `dialog`, `form`, `table`, `select`, `sheet`, `sidebar`, `chart`, `command`, … |
| `@simplycms/ui/utils`       | `cn()` — `clsx` + `tailwind-merge`                                             |
| `@simplycms/ui/use-toast`   | `useToast`, `toast`, тип `ToastVariant`                                        |
| `@simplycms/ui/use-mobile`  | `useIsMobile()`                                                                |
| `@simplycms/ui`             | Барель: усе разом; `sonner` — як `SonnerToaster` / `sonnerToast`                |

Radix-пакети, `cmdk`, `recharts`, `vaul`, `react-day-picker`, `input-otp` —
**optional** peer-залежності: ставиш лише те, що імпортуєш. Тому в коді ядра
всюди subpath-імпорт, а не барель.

## Приклад

```tsx
import { Link } from '@tanstack/react-router';
import { Button } from '@simplycms/ui/button';
import { Card, CardContent } from '@simplycms/ui/card';
import { cn } from '@simplycms/ui/utils';

export function EmptyCart({ className }: { className?: string }) {
  return (
    <Card className={cn('text-center', className)}>
      <CardContent className="py-16">
        <p className="text-muted-foreground mb-6">Кошик порожній</p>
        <Button asChild>
          <Link to="/catalog">До каталогу</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

## 🔴 Tailwind мусить сканувати `dist/` пакета

Класи компонентів живуть у зібраних `dist/*.js`, а Tailwind v4 `node_modules`
автодетектом **не** сканує — без явного джерела компоненти приїдуть без стилів:

```ts
content: ['./src/**/*.{ts,tsx}', './node_modules/@simplycms/*/dist/**/*.js'],
```

## Ліцензія

MIT
