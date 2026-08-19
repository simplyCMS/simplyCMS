import type { ReactNode } from 'react';

/**
 * Біла картка на сірому полотні — несуча цеглинка розкладки референсу
 * (вимір: `#ffffff`, `border-radius: 22px`, `padding: 32px`).
 *
 * 🔴 Радіус береться `rounded-lg`, бо в конфізі Tailwind магазину
 * `borderRadius.lg = var(--radius)`, а `--radius` теми — 1.375rem = 22px.
 * Тобто драбина радіусів теми (22 / 20 / 18) лягає на виміряну драбину
 * референсу (22 / 18 / 14) без жодного магічного числа в компоненті.
 */
export function ViewPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-lg bg-card p-6 sm:p-8 ${className ?? ''}`}>
      {children}
    </section>
  );
}

/** Заголовок панелі: 20px/700 — вимір референсу («Customer Reviews»). */
export function ViewPanelHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-xl font-bold text-foreground">{children}</h2>;
}
