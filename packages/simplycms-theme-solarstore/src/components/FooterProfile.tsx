import {
  AtSign,
  Camera,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Phone,
  Play,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SocialNetwork } from 'simplycms/contracts/store-profile';
import { useStoreProfile } from 'simplycms/themes/store-profile';
import { useThemeT } from 'simplycms/themes/useThemeT';
import type { SolarstoreThemeKey } from '../messages';

const ROW =
  'flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]';
const ROW_LINK = `${ROW} transition-colors hover:text-[hsl(var(--foreground))]`;

/**
 * 🔴 Іконки НЕЙТРАЛЬНІ, не бренд-логотипи: чужі логотипи заборонені правовими
 * межами фази 0. Мережу однозначно називає `aria-label`.
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
  const tt = useThemeT<SolarstoreThemeKey>();
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
            aria-label={tt(`theme.social.${social.network}`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </div>
  );
}

/** Колонка контактів профілю; порожні поля не рендеряться, без жодного — нічого. */
export function FooterContacts() {
  const { contacts } = useStoreProfile();
  const tt = useThemeT<SolarstoreThemeKey>();
  const { phone, email, address, hours } = contacts;
  if (!phone && !email && !address && !hours) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4 uppercase tracking-wider">
        {tt('theme.nav.contacts')}
      </h4>
      <div className="space-y-3">
        {phone && (
          <a href={telHref(phone)} className={ROW_LINK}>
            <Phone className="h-4 w-4 shrink-0" />
            <span>{phone}</span>
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={ROW_LINK}>
            <Mail className="h-4 w-4 shrink-0" />
            <span>{email}</span>
          </a>
        )}
        {address && (
          <div className={ROW}>
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{address}</span>
          </div>
        )}
        {hours && (
          <div className={ROW}>
            <Clock className="h-4 w-4 shrink-0" />
            <span>{hours}</span>
          </div>
        )}
      </div>
    </div>
  );
}
