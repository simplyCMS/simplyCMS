import { useRouter } from '@tanstack/react-router';
import { Languages } from 'lucide-react';
import { setAdminUiLocale } from 'simplycms/admin-server';
import { LANGUAGE_PACKS, useT, useUiLocale } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from 'simplycms/ui/dropdown-menu';

/**
 * Вибір мови інтерфейсу адмінки (І45): пишеться в `profiles.ui_locale` власного профілю.
 * Після запису `router.invalidate()` змушує `beforeLoad` `/admin` перечитати мову, а
 * лоадер частин підтягує каталог — без перезавантаження сторінки.
 */
export function UiLocaleSelect() {
  const t = useT();
  const current = useUiLocale();
  const router = useRouter();

  const choose = async (code: string) => {
    if (code === current) return;
    await setAdminUiLocale({ data: { uiLocale: code } });
    await router.invalidate();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1 px-2">
          <Languages className="h-4 w-4" />
          <span className="text-xs uppercase">{current}</span>
          <span className="sr-only">{t('admin.common.uiLocale')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={choose}>
          {[...LANGUAGE_PACKS.values()].map((pack) => (
            <DropdownMenuRadioItem key={pack.code} value={pack.code}>
              {pack.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
