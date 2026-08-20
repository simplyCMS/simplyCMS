import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import { PluginSlot } from '@simplycms/plugins/PluginSlot';
import { cn } from '@simplycms/ui/utils';

export interface ProductPluginSlotProps {
  className?: string;
  /** Контекст хука: товар і обрана модифікація (форма — як у сторінці). */
  context: Record<string, unknown>;
}

/**
 * Точки розширення плагінів на картці товару — теж реквізити: якщо тема їх
 * не розставить, встановлені плагіни мовчки зникнуть зі сторінки.
 *
 * 🔴 Обгортка — `display: contents`: маркер присутній завжди (навіть коли
 * жоден плагін не підписаний), але бокса не створює, тож вміст плагінів
 * лишається на тому самому місці розкладки, що й до виділення в слот.
 */
export function ProductPluginBefore({
  className,
  context,
}: ProductPluginSlotProps) {
  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.PluginBefore}
      className={cn('contents', className)}
    >
      <PluginSlot name="product.detail.before" context={context} />
    </div>
  );
}

export function ProductPluginBadges({
  className,
  context,
}: ProductPluginSlotProps) {
  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.PluginBadges}
      className={cn('contents', className)}
    >
      <PluginSlot
        name="product.card.badges"
        context={context}
        wrapper={(children) => <>{children}</>}
      />
    </div>
  );
}

export function ProductPluginAfter({
  className,
  context,
}: ProductPluginSlotProps) {
  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.PluginAfter}
      className={cn('contents', className)}
    >
      <PluginSlot name="product.detail.after" context={context} />
    </div>
  );
}
