import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useSyncExternalStore,
  ReactNode,
} from 'react';
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

interface CartContextType {
  items: readonly CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, modificationId: string | null) => void;
  updateQuantity: (
    productId: string,
    modificationId: string | null,
    quantity: number,
  ) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
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

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      writeCart((prev) => {
        const existingIndex = prev.findIndex(
          (i) =>
            i.productId === item.productId &&
            i.modificationId === item.modificationId,
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + (item.quantity || 1),
          };
          return updated;
        }

        return [...prev, { ...item, quantity: item.quantity || 1 }];
      });
      setIsOpen(true);
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

      writeCart((prev) =>
        prev.map((i) =>
          i.productId === productId && i.modificationId === modificationId
            ? { ...i, quantity }
            : i,
        ),
      );
    },
    [removeItem],
  );

  const clearCart = useCallback(() => writeCart(() => EMPTY_CART), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
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
