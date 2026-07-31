import type { ReactNode } from "react";
import { useActiveThemeModule } from "./useActiveThemeModule";
import { ThemeTokens } from "./ThemeTokens";

/**
 * Канонічний каркас сторфронту — заміна `theme.MainLayout`.
 *
 * Тема більше не постачає layout: вона дає лише `Header`/`Footer` і токени,
 * а структуру сторінки тримає ядро.
 */
export function StorefrontShell({ children }: { children?: ReactNode }) {
  const theme = useActiveThemeModule();
  const { Header, Footer } = theme.components;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      <ThemeTokens tokens={theme.tokens} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
