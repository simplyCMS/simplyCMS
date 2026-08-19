import { useT } from '@simplycms/i18n';
import type { CartViewModel } from '@simplycms/objects/views';

/**
 * ПРИКЛАД view-шару контракту v3 — кошик. Файл лежить у шаблоні окремо, а не
 * коментарем в `index.ts`: JSX у `.ts`-файлі не збирається ні tsc, ні esbuild,
 * тож приклад мусить бути справжнім `.tsx`-модулем.
 *
 * Поки `views` в `index.ts` закоментовано, цей файл ні на що не впливає:
 * сторінка кошика лишається канонічною. Щоб увімкнути — розкоментуй `views`
 * в `index.ts` і проженіть гейт: `pnpm simplycms theme:conformance
 * __THEME_NAME__`.
 *
 * 🔴 Комерційні реквізити (позиції, підсумок, перехід до оформлення) тема НЕ
 * переписує — вона їх РОЗСТАВЛЯЄ слотами. Логіка всередині слота лишається
 * ядру; загублений обовʼязковий слот = магазин без кнопки, і саме це червонить
 * conformance.
 *
 * Тексти: власні — через `useThemeT` (каталог теми), а вже наявні в ядрі — як
 * тут, через `useT()`.
 */
export function CartView({ itemCount, slots }: CartViewModel) {
  const t = useT();

  // Порожній кошик — крайній стан conformance: реквізитів тут немає СТРУКТУРНО
  // (разом із даними), і гейт їх на цьому стані не вимагає.
  if (itemCount === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {t('cart.empty.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('cart.empty.hint')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto grid gap-8 px-4 py-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <slots.Items />
        <slots.ClearCart />
      </div>
      <aside className="space-y-4">
        <slots.Summary />
        <slots.Checkout />
      </aside>
    </div>
  );
}
