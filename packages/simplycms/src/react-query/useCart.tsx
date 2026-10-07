import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useSyncExternalStore,
  ReactNode,
} from 'react';
import {
  addLine,
  clampQuantity,
  sameLine,
  type AddItemResult,
} from './cart-normalize';
import {
  EMPTY_CART,
  subscribe,
  getSnapshot,
  getServerSnapshot,
  getHydratedSnapshot,
  getHydratedServerSnapshot,
  writeCart,
  type CartItem,
} from './cart-store';

// Клієнтський стан кошика (localStorage). Сам стор (снапшот,
// useSyncExternalStore) — у `cart-store.ts`; тут лише React-обвʼязка
// (контекст, провайдер, дії).

export type { CartItem };
export type { AddItemResult } from './cart-normalize';

interface CartContextType {
  items: readonly CartItem[];
  addItem: (
    item: Omit<CartItem, 'quantity'> & { quantity?: number },
  ) => AddItemResult;
  removeItem: (productId: string, modificationId: string | null) => void;
  updateQuantity: (
    productId: string,
    modificationId: string | null,
    quantity: number,
  ) => void;
  clearCart: () => void;
  totalItems: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /**
   * Гідратація завершена (Е0-5, рішення А архітектора): до цього `items` —
   * ЗАВЖДИ порожній, навіть якщо localStorage непорожній (інакше React
   * #418). Редирект і гілка «кошик порожній» гейтяться саме на цьому
   * прапорці — це ЄДИНА ознака гідратації кошика в застосунку.
   */
  hydrated: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );
  const [isOpen, setIsOpen] = useState(false);

  // 🔴 Ціни в позиції немає: наявна позиція лише збільшує кількість, а суму
  // перераховує серверна квота на новий склад кошика.
  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      let result: AddItemResult = 'added';
      writeCart((prev) => {
        const next = addLine(prev, item);
        result = next.result;
        return next.lines;
      });
      if (result === 'added') setIsOpen(true);
      return result;
    },
    [],
  );

  const removeItem = useCallback(
    (productId: string, modificationId: string | null) => {
      writeCart((prev) =>
        prev.filter(
          (i) =>
            !(i.productId === productId && i.modificationId === modificationId),
        ),
      );
    },
    [],
  );

  const updateQuantity = useCallback(
    (productId: string, modificationId: string | null, quantity: number) => {
      if (quantity < 1) {
        removeItem(productId, modificationId);
        return;
      }

      // Межа рядка тримається й тут: поле кількості чи «+» не виводять
      // кошик за `MAX_LINE_QUANTITY`, яку відкинув би серверний валідатор.
      const clamped = clampQuantity(quantity);
      writeCart((prev) =>
        prev.map((i) =>
          sameLine(i, { productId, modificationId })
            ? { ...i, quantity: clamped }
            : i,
        ),
      );
    },
    [removeItem],
  );

  const clearCart = useCallback(() => writeCart(() => EMPTY_CART), []);

  // Суми тут немає (Е6в-13): її рахує лише серверна квота (`useCartQuote`).
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        isOpen,
        setIsOpen,
        hydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
