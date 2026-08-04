/**
 * Брендові іконки соцмереж — власні SVG теми.
 *
 * 🔴 Не з `lucide-react`: у версії 1.0 апстрім прибрав усі брендові іконки
 * (Facebook, Instagram, …) з причин торгових марок, і повернення їх не
 * планується. Тема — це презентація, тож найдешевше й найчесніше тримати
 * такі гліфи в самій темі, а не тягнути ще одну залежність-набір іконок.
 *
 * Пропси навмисно збігаються з lucide-контрактом (`className`), щоб
 * розмітка Footer-а лишилась незмінною.
 */

type IconProps = { className?: string };

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
