import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Languages } from 'lucide-react';
import { setAdminUiLocale } from 'simplycms/admin-server';
import { useToast } from 'simplycms/core/hooks/use-toast';
import { listLanguagePacks, useT, useUiLocale } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from 'simplycms/ui/dropdown-menu';

/** Лише пакети з частиною `admin` (§19.15): інші адмінка показати не може. */
const adminPacks = listLanguagePacks().filter((pack) =>
  pack.parts.includes('admin'),
);

/**
 * Вибір мови інтерфейсу адмінки (І45): пишеться в `profiles.ui_locale` власного профілю.
 * Після запису `router.invalidate()` змушує `beforeLoad` `/admin` перечитати мову, а
 * лоадер частин підтягує каталог — без перезавантаження сторінки.
 */
export function UiLocaleSelect() {
  const t = useT();
  const current = useUiLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const choose = async (code: string) => {
    if (code === current || pending) return;
    setPending(true);
    try {
      await setAdminUiLocale({ data: { uiLocale: code } });
      await router.invalidate();
    } catch {
      // Мова лишилась попередньою: без повідомлення вибір мовчки «не спрацював» би.
      toast({
        title: t('admin.common.uiLocaleFailed'),
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 px-2"
          disabled={pending}
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs uppercase">{current}</span>
          <span className="sr-only">{t('admin.common.uiLocale')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={choose}>
          {adminPacks.map((pack) => (
            <DropdownMenuRadioItem key={pack.code} value={pack.code}>
              {pack.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
