import { useThemeT } from '@simplycms/themes/useThemeT';
import type { ThemeKey } from '../messages';

/**
 * Підвал теми — другий обовʼязковий компонент контракту v2. Рік у копірайті
 * підставляється параметром `{year}`: інтерполяцію робить сам `useThemeT`
 * (та сама `interpolate`, що й у транслятора ядра).
 */
export function Footer() {
  const tt = useThemeT<ThemeKey>();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto flex flex-col gap-2 px-4 py-10 text-sm text-muted-foreground">
        <span>{tt('theme.footer.tagline')}</span>
        <span>
          {tt('theme.footer.copyright', {
            year: new Date().getFullYear(),
          })}
        </span>
      </div>
    </footer>
  );
}
