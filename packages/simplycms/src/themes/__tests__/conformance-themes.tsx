// Синтетичні теми для негативного контролю conformance-kit-а (Р8).
//
// 🔴 Теми тут саме СИНТЕТИЧНІ, а не реальні з `themes/`: kit має червоніти
// на конкретному дефекті, і дефект треба вміти внести навмисно. Реальна
// тема доводила б лише «сьогодні все добре».

import type {
  CartViewModel,
  ProductDetailViewModel,
} from 'simplycms/contracts/views';
import type { ThemeModule, ThemeViews } from '../types';

function Stub() {
  return <div />;
}

export function makeTheme(
  views?: ThemeViews,
  extra?: Partial<ThemeModule>,
): ThemeModule {
  return {
    manifest: {
      name: 'conformance-fixture',
      displayName: 'Conformance Fixture',
      version: '1.0.0',
      engines: { simplycms: '>=0.0.0' },
    },
    tokens: {},
    components: { Header: Stub, Footer: Stub },
    views,
    ...extra,
  };
}

/** Валідний view: розставлені всі девʼять реквізитів картки товару. */
export function GoodProductDetail({ slots }: ProductDetailViewModel) {
  return (
    <div>
      <slots.PluginBefore />
      <slots.StockBadge />
      <slots.PluginBadges />
      <slots.PriceBlock />
      <slots.ModificationSelector />
      <slots.AddToCart />
      <slots.StockAvailability />
      <slots.Reviews />
      <slots.PluginAfter />
    </div>
  );
}

/** Дефект №1: тема загубила кнопку купівлі — воронка зламана мовчки. */
export function ProductDetailWithoutAddToCart({
  slots,
}: ProductDetailViewModel) {
  return (
    <div>
      <slots.PluginBefore />
      <slots.StockBadge />
      <slots.PluginBadges />
      <slots.PriceBlock />
      <slots.ModificationSelector />
      <slots.StockAvailability />
      <slots.Reviews />
      <slots.PluginAfter />
    </div>
  );
}

/** Валідний кошик: порожній стан структурно без реквізитів (спека §5). */
export function GoodCart({ itemCount, slots }: CartViewModel) {
  if (itemCount === 0) return <div data-testid="empty-cart" />;

  return (
    <div>
      <slots.Items />
      <slots.ClearCart />
      <slots.Summary />
      <slots.Checkout />
    </div>
  );
}

/** Дефект №2: view падає саме на крайньому стані — порожньому кошику. */
export function CartCrashingWhenEmpty({ itemCount, slots }: CartViewModel) {
  if (itemCount === 0) {
    throw new Error('cart view: не передбачено порожній кошик');
  }

  return (
    <div>
      <slots.Items />
      <slots.Summary />
      <slots.Checkout />
    </div>
  );
}
