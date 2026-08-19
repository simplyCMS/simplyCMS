import type { LucideIcon } from 'lucide-react';
import { RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { ThemeKey } from '../../messages';

interface TrustItem {
  icon: LucideIcon;
  labelKey: ThemeKey;
  noteKey: ThemeKey;
}

const ITEMS: TrustItem[] = [
  {
    icon: ShieldCheck,
    labelKey: 'theme.product.trustAuthentic',
    noteKey: 'theme.product.trustAuthenticNote',
  },
  {
    icon: Truck,
    labelKey: 'theme.product.trustShipping',
    noteKey: 'theme.product.trustShippingNote',
  },
  {
    icon: RotateCcw,
    labelKey: 'theme.product.trustReturns',
    noteKey: 'theme.product.trustReturnsNote',
  },
];

/**
 * Ряд обіцянок магазину в підвалі картки інформації.
 *
 * Вимір референсу: `grid-cols-3 gap-3`, чип `44px` `rounded-full bg-gray-100`
 * з іконкою 18px, підпис `12px/600`, нота `11px` приглушеним; середня комірка
 * відділена вертикальними рамками (`border-x`).
 *
 * 🔴 Тексти — ВЛАСНІ, з каталогу теми: це обіцянки нашого магазину, а не
 * факти про товар і не рядки референсу (правові межі фази 0 скіла). Власник
 * магазину міняє їх у `themes/default/messages.ts`, не чіпаючи компонента.
 */
export function ProductTrustRow() {
  const tt = useThemeT<ThemeKey>();

  return (
    <div className="mt-auto grid grid-cols-3 gap-3 pt-6">
      {ITEMS.map((item, index) => (
        <div
          key={item.labelKey}
          className={`space-y-2 text-center ${index === 1 ? 'border-x border-border' : ''}`}
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <item.icon className="h-[18px] w-[18px] text-primary" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {tt(item.labelKey)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {tt(item.noteKey)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
