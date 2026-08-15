import { Link } from '@tanstack/react-router';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { ThemeKey } from '../messages';

/**
 * Хедер теми — обовʼязковий компонент контракту v2: його рендерять обидва
 * каркаси ядра (`StorefrontShell` / `ProtectedShell`) над канонічною
 * сторінкою. Тексти — лише через `useThemeT` (каталог теми), класи — наявні
 * semantic-змінні, які заповнює `applyTokens(tokens)`.
 */
export function Header() {
  const tt = useThemeT<ThemeKey>();

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="text-lg font-bold text-foreground">
          {tt('theme.brand')}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            to="/catalog"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            {tt('theme.nav.catalog')}
          </Link>
          <Link
            to="/cart"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            {tt('theme.nav.cart')}
          </Link>
        </nav>
      </div>
    </header>
  );
}
