import { Link } from '@tanstack/react-router';
import { AtSign, MessageCircle, Rss } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { useThemeT } from '@simplycms/themes/useThemeT';
import { MONO_LABEL, MONO_STACK } from './mono';
import type { ThemeKey } from '../messages';

/** Кругла соцкнопка 36×36 (спека §3). Логотипів брендів референсу не несе. */
const SOCIAL_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const LINK =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';

/**
 * Footer default-теми — спека: локальний артефакт
 * `docs/design-references/…/components/Footer.spec.md` (поза git).
 *
 * Модель взаємодії — static: жодних акордеонів навіть на 390px, колонки
 * просто перебудовуються сіткою.
 *
 * 🔴 Посилання референсу (New Arrivals, Luxury, FAQ, Size Guide, Press…) не
 * переносимо: таких сторінок у магазині немає, а мертвий лінк гірший за його
 * відсутність — на самому референсі вони, до речі, віддають 404.
 */
export function Footer() {
  const t = useT();
  const tt = useThemeT<ThemeKey>();

  const columns = [
    {
      heading: tt('theme.footer.colShop'),
      items: [
        { to: '/catalog', label: t('catalog.title') },
        { to: '/cart', label: t('cart.title') },
      ],
    },
    {
      heading: tt('theme.footer.colAccount'),
      items: [
        { to: '/profile', label: t('nav.profile') },
        { to: '/profile/orders', label: t('nav.orders') },
        { to: '/profile/settings', label: t('nav.settings') },
      ],
    },
    {
      heading: tt('theme.footer.colStore'),
      items: [
        { to: '/', label: tt('theme.footer.linkHome') },
        { to: '/checkout', label: tt('theme.footer.linkCheckout') },
      ],
    },
  ] as const;

  // 🔴 Іконки НЕЙТРАЛЬНІ, не бренд-логотипи: чужі логотипи заборонені
  // правовими межами фази 0. Зайвим доказом — сам `lucide-react@1.28`
  // бренд-іконок уже не експортує.
  const socials = [
    { icon: Rss, label: tt('theme.footer.socialFeed') },
    { icon: MessageCircle, label: tt('theme.footer.socialCommunity') },
    { icon: AtSign, label: tt('theme.footer.socialContact') },
  ] as const;

  return (
    <footer className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="text-lg font-bold text-foreground">
              {tt('theme.brand')}
            </span>
            <p className="mt-2 max-w-[240px] text-sm text-muted-foreground">
              {tt('theme.footer.tagline')}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  className={SOCIAL_BUTTON}
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h3
                className={`${MONO_LABEL} text-muted-foreground`}
                style={{ fontFamily: MONO_STACK }}
              >
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2">
                {column.items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={LINK}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-[13px] text-muted-foreground">
          {tt('theme.footer.copyright').replace(
            '{year}',
            String(new Date().getFullYear()),
          )}
        </div>
      </div>
    </footer>
  );
}
