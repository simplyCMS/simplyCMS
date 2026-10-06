import { Sun } from 'lucide-react';
import { useStoreProfile } from 'simplycms/themes/store-profile';

/**
 * Бренд магазину з профілю: логотип замінює назву (його `alt` уже називає
 * магазин), а без логотипа лишається іконка теми й текст `name`.
 * `size` — лише оформлення шапки й підвалу, дані ті самі.
 */
export function BrandMark({ size }: { size: 'header' | 'footer' }) {
  const { name, logoUrl } = useStoreProfile();
  const header = size === 'header';

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={header ? 'h-10 w-auto max-w-48' : 'h-8 w-auto max-w-40'}
      />
    );
  }

  return (
    <>
      <div
        className={`flex items-center justify-center rounded-lg bg-[hsl(var(--primary))] ${
          header ? 'h-10 w-10' : 'h-8 w-8'
        }`}
      >
        <Sun className={`text-white ${header ? 'h-6 w-6' : 'h-4 w-4'}`} />
      </div>
      <span
        className={
          header
            ? 'text-xl font-bold text-[hsl(var(--foreground))]'
            : 'font-semibold text-[hsl(var(--foreground))]'
        }
      >
        {name}
      </span>
    </>
  );
}
