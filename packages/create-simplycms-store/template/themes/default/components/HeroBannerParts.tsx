import { Link } from '@tanstack/react-router';
import type { BannerButton } from 'simplycms/contracts/objects';

export const CTA_BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export const ALIGN = {
  left: { text: 'text-left', row: 'sm:justify-start' },
  center: { text: 'text-center', row: 'sm:justify-center' },
  right: { text: 'text-right', row: 'sm:justify-end' },
} as const;

const CTA_VARIANT: Record<BannerButton['variant'], string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
};

/** Кнопка банера; `button` уже пройшла `isBannerButton` (url: `/шлях` або http(s)). */
export function BannerCta({ button }: { button: BannerButton }) {
  const className = `${CTA_BASE} ${CTA_VARIANT[button.variant]}`;
  if (button.url.startsWith('/') && button.target !== '_blank') {
    return (
      <Link to={button.url} className={className}>
        {button.text}
      </Link>
    );
  }
  return (
    <a
      href={button.url}
      className={className}
      {...(button.target === '_blank'
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
    >
      {button.text}
    </a>
  );
}
