import type {
  ProductDetailCharacteristics,
  ProductDetailSlots,
  ProductDetailSummary,
} from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { MONO_STACK } from '../../components/mono';
import { ProductHighlights } from './ProductHighlights';
import { ProductTrustRow } from './ProductTrustRow';

interface ProductSummaryCardProps {
  summary: ProductDetailSummary;
  characteristics: ProductDetailCharacteristics;
  slots: ProductDetailSlots;
  /** Назва батьківського розділу з крихт; `null` — товар поза розділом. */
  sectionLabel: string | null;
}

/**
 * Права картка сітки: усе, що покупець читає перед покупкою.
 *
 * Комерційні реквізити тут лише РОЗСТАВЛЕНІ (`slots.*`) — ціна, наявність,
 * вибір модифікації й кнопка купівлі належать ядру. Вимір референсу:
 * мета-рядок «бренд · категорія» моно 14px, H1 36px/700 із трекінгом
 * -0.9px, короткий опис 15px, дії — pill-кнопка на всю ширину колонки.
 *
 * 🔴 Мета-рядок у нас — «розділ · артикул», а не «бренд · категорія»: бренда
 * у `ProductDetailViewModel` немає, а артикул є (`summary.sku`). Беремо те,
 * що дають дані, замість того, щоб вигадувати поле.
 */
export function ProductSummaryCard({
  summary,
  characteristics,
  slots,
  sectionLabel,
}: ProductSummaryCardProps) {
  const t = useT();
  const hasMeta = sectionLabel !== null || summary.sku !== null;

  return (
    <div className="flex flex-col rounded-lg bg-card p-6 sm:p-8">
      {/* Реквізит: точка розширення плагінів перед блоком інформації */}
      <slots.PluginBefore />

      <div className="mb-3 flex items-start justify-between gap-3">
        {hasMeta && (
          <p
            className="flex items-center gap-2 text-sm"
            style={{ fontFamily: MONO_STACK }}
          >
            {sectionLabel !== null && (
              <span className="font-medium text-foreground">
                {sectionLabel}
              </span>
            )}
            {sectionLabel !== null && summary.sku !== null && (
              <span className="text-border">·</span>
            )}
            {summary.sku !== null && (
              <span className="text-muted-foreground">
                {t('product.sku', { sku: summary.sku })}
              </span>
            )}
          </p>
        )}

        <span className="flex shrink-0 items-center gap-2">
          {/* Реквізити: бейдж наявності + бейджі плагінів */}
          <slots.StockBadge />
          <slots.PluginBadges />
        </span>
      </div>

      <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
        {summary.name}
      </h1>

      {/* Реквізит: ціна (типографіка всередині — ядра) */}
      <slots.PriceBlock className="mt-4" />

      {summary.short_description && (
        <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
          {summary.short_description}
        </p>
      )}

      <ProductHighlights characteristics={characteristics} />

      {/* Реквізит: вибір модифікації */}
      <slots.ModificationSelector className="mt-6" />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {/* Реквізит: додавання в кошик */}
        <slots.AddToCart className="h-14 flex-1 rounded-full text-sm font-medium" />
      </div>

      <ProductTrustRow />
    </div>
  );
}
