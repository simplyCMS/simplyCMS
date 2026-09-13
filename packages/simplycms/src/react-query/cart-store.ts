import type { Json } from 'simplycms/contracts';

/**
 * Зовнішній стор кошика (К2-Е0, Е0-5) — модуль-синглтон за патерном
 * `plugins/HookRegistry`; підключення до React (`useSyncExternalStore`) —
 * у `useCart.tsx`. Винесено в окремий файл, щоб `useCart.tsx` вкладався в
 * канон 150 рядків.
 *
 * 🔴 Чому не `useState` з lazy-ініціалізатором (як було): він читав
 * localStorage у ПЕРШОМУ клієнтському рендері, тобто в рендері гідратації;
 * сервер віддавав порожній кошик, клієнт — повний, і бейдж у шапці ставав
 * зайвим DOM-вузлом (React #418 на кожній SSR-сторінці з товаром у кошику).
 * `useSyncExternalStore` дає React серверний снапшот (порожньо) на
 * гідратацію і клієнтський — одразу після; бейдж зʼявляється без
 * розбіжності.
 *
 * Снапшот кешується: `getSnapshot` віддає ту саму референцію, доки стор не
 * змінився — `JSON.parse` на кожен виклик дав би нескінченний рендер.
 * Перечитування localStorage — при переході 0→1 підписників (тести й
 * перемонтування) і на `storage`-подію (інша вкладка).
 */

export interface CartItem {
  productId: string;
  modificationId: string | null;
  name: string;
  modificationName?: string;
  price: number;
  basePrice?: number | null;
  discountData?: Json | null;
  quantity: number;
  image?: string;
  sku?: string;
}

const CART_STORAGE_KEY = 'simplycms-cart';
export const EMPTY_CART: readonly CartItem[] = [];

let snapshot: readonly CartItem[] = EMPTY_CART;
const listeners = new Set<() => void>();

const read = (): readonly CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as CartItem[];
    }
  } catch (e) {
    console.error('Failed to load cart from localStorage:', e);
  }
  return EMPTY_CART;
};

const onStorage = (event: StorageEvent): void => {
  if (event.key !== null && event.key !== CART_STORAGE_KEY) return;
  snapshot = read();
  listeners.forEach((l) => l());
};

export const subscribe = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    snapshot = read();
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
};

export const getSnapshot = (): readonly CartItem[] => snapshot;
export const getServerSnapshot = (): readonly CartItem[] => EMPTY_CART;

/**
 * Ознака гідратації (рішення А архітектора, К2-Е0) — той самий `subscribe`,
 * що й позиції кошика: другий незалежний стор заради булевого прапорця не
 * потрібен, підписка йде на той самий Set слухачів. Значення не залежить
 * від ВМІСТУ localStorage — лише від того, чи відбувся клієнтський рендер
 * після mount (сервер завжди `false`, клієнт — завжди `true`).
 */
export const getHydratedSnapshot = (): boolean => true;
export const getHydratedServerSnapshot = (): boolean => false;

/** Записати новий стан кошика: снапшот → localStorage → сповіщення підписників. */
export function writeCart(
  update: (prev: readonly CartItem[]) => readonly CartItem[],
): void {
  snapshot = update(snapshot);
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.error('Failed to save cart to localStorage:', e);
  }
  listeners.forEach((l) => l());
}
