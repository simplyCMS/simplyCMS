import {
  AtSign,
  Camera,
  MessageCircle,
  Music,
  Play,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useStoreProfile } from 'simplycms/themes/store-profile';
import { useThemeT } from 'simplycms/themes/useThemeT';
import type { SocialNetwork } from 'simplycms/contracts/store-profile';
import { MONO_LABEL, MONO_STACK } from './mono';
import type { ThemeKey } from '../messages';

/** Кругла соцкнопка 36×36 (спека §3). */
const SOCIAL_BUTTON =
  'flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const LINK =
  'text-sm text-muted-foreground transition-colors hover:text-foreground';

/**
 * 🔴 Іконки НЕЙТРАЛЬНІ, не бренд-логотипи: чужі логотипи заборонені
 * правовими межами фази 0 (а `lucide-react@1.28` бренд-іконок уже не
 * експортує). Мережу однозначно називає `aria-label`.
 */
const SOCIAL_ICONS: Record<SocialNetwork, LucideIcon> = {
  instagram: Camera,
  facebook: Users,
  telegram: Send,
  tiktok: Music,
  youtube: Play,
  x: AtSign,
  viber: MessageCircle,
};

/** Для `tel:` лишаються лише `+` і цифри: пробіли, дужки й дефіси не потрібні. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

/** Соцмережі профілю; порожній список не лишає й порожнього контейнера. */
export function FooterSocials() {
  const { socials } = useStoreProfile();
  const tt = useThemeT<ThemeKey>();
  if (socials.length === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-2">
      {socials.map((social) => {
        const Icon = SOCIAL_ICONS[social.network];
        return (
          <a
            key={`${social.network}:${social.url}`}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className={SOCIAL_BUTTON}
            aria-label={tt(`theme.social.${social.network}`)}
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}

/** Контакти профілю; порожні поля не рендеряться, без жодного — нічого. */
export function FooterContacts() {
  const { contacts } = useStoreProfile();
  const tt = useThemeT<ThemeKey>();
  const { phone, email, address, hours } = contacts;
  if (!phone && !email && !address && !hours) return null;

  return (
    <div>
      <h3
        className={`${MONO_LABEL} text-muted-foreground`}
        style={{ fontFamily: MONO_STACK }}
      >
        {tt('theme.footer.colContacts')}
      </h3>
      <ul className="mt-4 space-y-2">
        {phone && (
          <li>
            <a href={telHref(phone)} className={LINK}>
              {phone}
            </a>
          </li>
        )}
        {email && (
          <li>
            <a href={`mailto:${email}`} className={LINK}>
              {email}
            </a>
          </li>
        )}
        {address && <li className={LINK}>{address}</li>}
        {hours && <li className={LINK}>{hours}</li>}
      </ul>
    </div>
  );
}
