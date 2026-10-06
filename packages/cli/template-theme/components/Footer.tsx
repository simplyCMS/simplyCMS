import { useStoreProfile } from 'simplycms/themes/store-profile';
import { useThemeT } from 'simplycms/themes/useThemeT';
import type { ThemeKey } from '../messages';

/**
 * Підвал теми — другий обовʼязковий компонент контракту v2. Рік і назва
 * магазину в копірайті підставляються параметрами `{year}`/`{name}`:
 * інтерполяцію робить сам `useThemeT` (та сама `interpolate`, що й у
 * транслятора ядра), а назву дає профіль (`useStoreProfile()`).
 */
export function Footer() {
  const tt = useThemeT<ThemeKey>();
  const { name } = useStoreProfile();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto flex flex-col gap-2 px-4 py-10 text-sm text-muted-foreground">
        <span>{tt('theme.footer.tagline')}</span>
        <span>
          {tt('theme.footer.copyright', {
            year: new Date().getFullYear(),
            name,
          })}
        </span>
      </div>
    </footer>
  );
}
