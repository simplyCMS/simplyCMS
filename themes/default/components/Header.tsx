import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ShoppingBag } from 'lucide-react';
import { CartDrawer } from '@simplycms/core/components/cart/CartDrawer';
import { useT } from '@simplycms/i18n';
import { useThemeT } from '@simplycms/themes/useThemeT';
import { HeaderActions } from './HeaderActions';
import type { ThemeKey } from '../messages';

/**
 * Пункт навігаційної пігулки. Активний — заливка `muted` (виміряно #f3f4f6).
 *
 * 🔴 Тривалість саме 200 мс, а не дефолтні 150 мс `transition-colors`:
 * пункти меню референсу сидять у кластері `all 200ms` (`count: 29`), і це
 * доведено адресно — клас самого вузла в `motion.hover.entries` має
 * `transition-all duration-200 ease-in-out` (спека §7.1). Ховер-заливка —
 * теж вимір: `background-color: transparent → #f9fafb`, найближчий токен
 * контракту — `muted`.
 *
 * 🔴 Ховер тексту — `primary` (#333333), а НЕ `foreground` (#0a0a0a):
 * виміряний ховер референсу — #334153 (`motion.hover`, спека §7.3), і з
 * усіх токенів контракту до нього найближчий саме `primary`. Активний
 * пункт лишається `foreground` — там вимір дає #0a0a0a.
 */
function navItem(isActive: boolean) {
  return [
    'rounded-full px-4 py-2 text-sm font-medium',
    'transition-all duration-200 ease-in-out',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-primary',
  ].join(' ');
}

/**
 * Header default-теми — спека: локальний артефакт
 * `docs/design-references/…/components/Header.spec.md` (поза git).
 *
 * 🔴 Модель взаємодії — static + click: панель НЕ приклеюється. Референс
 * виміряно як `position: static`, і зробити тут sticky означало б
 * побудувати іншу модель, ніж у джерела, — найдорожча помилка цієї фази.
 *
 * 🔴 Навігаційна пігулка притиснута ЛІВОРУЧ, поруч із логотипом (вимір:
 * лого x=96, перший пункт x=156), а біла — сама група; активний пункт
 * навпаки темніший. Це розходиться з усною настановою «центрована, активний
 * — біла пігулка», і спека фіксує саме вимір (див. §2 спеки).
 */
export function Header() {
  const t = useT();
  const tt = useThemeT<ThemeKey>();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Пункти референсу (Contact/About/Overview) не переносимо — таких сторінок
  // у магазині немає; беремо лише наші реальні роути.
  const links = [
    { to: '/', label: tt('theme.nav.home'), active: pathname === '/' },
    {
      to: '/catalog',
      label: t('catalog.title'),
      active: pathname.startsWith('/catalog'),
    },
  ] as const;

  return (
    <>
      <header className="w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:h-20">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="truncate text-lg font-bold text-foreground">
                {tt('theme.brand')}
              </span>
            </Link>

            <nav className="hidden items-center rounded-full bg-card px-2 py-1.5 md:flex">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={navItem(link.active)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <HeaderActions
            menuOpen={menuOpen}
            onToggleMenu={() => setMenuOpen(!menuOpen)}
          />
        </div>

        {menuOpen && (
          <nav className="mx-auto max-w-7xl px-4 pb-4 md:hidden">
            <div className="flex flex-col gap-1 rounded-[--radius] bg-card p-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={navItem(link.active)}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <CartDrawer />
    </>
  );
}
