import type { DesignTokens } from '@simplycms/themes/types';

/**
 * Токени default-теми — тепла бежева палітра з кораловим акцентом.
 *
 * Значення перенесені 1:1 з колишнього `styles/theme.css` (`.default-theme`);
 * сам CSS-файл видалено — тема більше не постачає стилів, лише значення для
 * наявних semantic-змінних shadcn.
 */
export const tokens: DesignTokens = {
  // Тло
  background: '30 33% 93%',
  foreground: '20 10% 20%',

  // Картки
  card: '30 33% 97%',
  'card-foreground': '20 10% 20%',

  // Поповери
  popover: '30 33% 97%',
  'popover-foreground': '20 10% 20%',

  // Основний — кораловий
  primary: '4 58% 56%',
  'primary-foreground': '0 0% 100%',

  // Вторинний
  secondary: '30 20% 88%',
  'secondary-foreground': '20 10% 25%',

  // Приглушений
  muted: '30 15% 90%',
  'muted-foreground': '20 8% 45%',

  // Акцент
  accent: '30 30% 90%',
  'accent-foreground': '4 58% 46%',

  // Деструктивний
  destructive: '0 72% 51%',
  'destructive-foreground': '0 0% 100%',

  // Межі
  border: '30 15% 82%',
  input: '30 15% 82%',
  ring: '4 58% 56%',

  // Радіус — мʼякший
  radius: '0.375rem',
};
