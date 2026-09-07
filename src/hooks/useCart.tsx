import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartItem {
  productId: string;
  modificationId: string | null;
  name: string;
  modificationName?: string;
  price: number;
  basePrice?: number | null;
  discountData?: any | null;
  quantity: number;
  image?: string;
  sku?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string, modificationId: string | null) => void;
  updateQuantity: (productId: string, modificationId: string | null, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "solarstore-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage:", e);
    }
    setIsInitialized(true);
  }, []);

  // Save cart to localStorage when items change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error("Failed to save cart to localStorage:", e);
      }
    }
  }, [items, isInitialized]);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.productId === item.productId && i.modificationId === item.modificationId
      );

      if (existingIndex >= 0) {
        // Update quantity of existing item
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + (item.quantity || 1),
        };
        return updated;
      }

      // Add new item
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string, modificationId: string | null) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && i.modificationId === modificationId)
      )
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, modificationId: string | null, quantity: number) => {
      if (quantity < 1) {
        removeItem(productId, modificationId);
        return;
      }

      setItems((prev) =>
        prev.map((i) =>
          i.productId === productId && i.modificationId === modificationId
            ? { ...i, quantity }
            : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
