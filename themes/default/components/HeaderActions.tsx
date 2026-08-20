import { Link, useNavigate } from '@tanstack/react-router';
import {
  LogOut,
  Menu,
  Search,
  Settings,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@simplycms/ui/dropdown-menu';
import { useAuth } from '@simplycms/core/hooks/useAuth';
import { useCart } from '@simplycms/core/hooks/useCart';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { ThemeKey } from '../messages';

/**
 * Кругла кнопка-іконка правої групи: 40×40, біла, pill (спека §3).
 *
 * 🔴 200 мс — з виміру: іконкові кнопки референсу в тому ж кластері `all
 * 200ms`, що й пункти навігації (спека §7.1), а не в дефолтному 150 мс.
 *
 * 🔴 Пара кольорів іконки — `muted-foreground` → `primary`, як у пунктів
 * навігації. Це вимір, а не смак: референс дає #687282 у спокої і #334153
 * під курсором (`motion.hover`, спека §7.3). Половинчаста правка (лишити
 * спокій `foreground` #0a0a0a і додати лише ховер `primary`) зробила б
 * кнопку під курсором СВІТЛІШОЮ за спокій — тобто ввела б дефект замість
 * того, щоб прибрати розбіжність.
 */
const ICON_BUTTON =
  'flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground transition-all duration-200 ease-in-out hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * Права група хедера: пошук / акаунт / кошик / бургер.
 *
 * Виділено з `Header.tsx` не заради краси, а за каноном: разом файл виходив
 * на 193 рядки при межі 150 (скіл: «не влазить — це два компоненти»).
 * Межа різу природна — тут живуть усі дії й уся робота з авторизацією,
 * у `Header` лишається лейаут і навігація.
 */
export function HeaderActions({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const t = useT();
  const tt = useThemeT<ThemeKey>();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { totalItems, setIsOpen } = useCart();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    toast(
      error
        ? {
            variant: 'destructive',
            title: t('common.error'),
            description: tt('theme.header.signOutError'),
          }
        : { title: tt('theme.header.signedOut') },
    );
  };

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/catalog"
        className={`hidden sm:flex ${ICON_BUTTON}`}
        aria-label={tt('theme.header.search')}
      >
        <Search className="h-4 w-4" />
      </Link>

      {/* Поки стан авторизації не відомий — не рендеримо нічого: інакше
          кнопка «Увійти» мигала б перед аватаром уже залогіненого. */}
      {!authLoading &&
        (user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={ICON_BUTTON}
              aria-label={tt('theme.header.account')}
            >
              <User className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
                <User className="mr-2 h-4 w-4" />
                {tt('theme.header.myAccount')}
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate({ to: '/admin' })}>
                  <Settings className="mr-2 h-4 w-4" />
                  {tt('theme.header.adminPanel')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('nav.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            to="/auth"
            className={ICON_BUTTON}
            aria-label={t('auth.login.submit')}
          >
            <User className="h-4 w-4" />
          </Link>
        ))}

      <button
        type="button"
        className={`relative ${ICON_BUTTON}`}
        onClick={() => setIsOpen(true)}
        aria-label={t('cart.title')}
      >
        <ShoppingBag className="h-4 w-4" />
        {/* Порожній кошик — бейджа немає зовсім, а не «0» (спека §4). */}
        {totalItems > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {totalItems}
          </span>
        )}
      </button>

      <button
        type="button"
        className={`md:hidden ${ICON_BUTTON}`}
        onClick={onToggleMenu}
        aria-label={tt('theme.header.menu')}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
    </div>
  );
}
