import type { DesignTokens } from "@simplycms/themes/types";

/**
 * Токени SolarStore — синя палітра (#1192DC) зі світлим і темним режимами.
 *
 * Значення перенесені 1:1 з колишнього `styles/theme.css`
 * (`.solarstore-theme` і `.dark .solarstore-theme`); сам CSS-файл видалено.
 * Темний блок ядро рендерить під селектором `.dark` — клас на `<html>`
 * ставить next-themes.
 */
export const tokens: DesignTokens = {
  background: "210 20% 98%",
  foreground: "210 20% 10%",

  card: "0 0% 100%",
  "card-foreground": "210 20% 10%",

  popover: "0 0% 100%",
  "popover-foreground": "210 20% 10%",

  // Основний — сонячний синій #1192DC
  primary: "203 85% 47%",
  "primary-foreground": "0 0% 100%",

  secondary: "210 15% 93%",
  "secondary-foreground": "210 20% 20%",

  muted: "210 15% 95%",
  "muted-foreground": "210 10% 45%",

  accent: "203 40% 92%",
  "accent-foreground": "203 85% 40%",

  destructive: "0 72% 51%",
  "destructive-foreground": "0 0% 100%",

  success: "142 71% 45%",
  "success-foreground": "0 0% 100%",

  warning: "38 92% 50%",
  "warning-foreground": "0 0% 100%",

  border: "210 15% 88%",
  input: "210 15% 88%",
  ring: "203 85% 47%",

  radius: "0.5rem",

  dark: {
    background: "210 20% 8%",
    foreground: "210 15% 92%",

    card: "210 20% 12%",
    "card-foreground": "210 15% 92%",

    popover: "210 20% 12%",
    "popover-foreground": "210 15% 92%",

    // Яскравіший синій у темному режимі
    primary: "203 85% 55%",
    "primary-foreground": "0 0% 100%",

    secondary: "210 15% 18%",
    "secondary-foreground": "210 15% 85%",

    muted: "210 15% 15%",
    "muted-foreground": "210 10% 55%",

    accent: "203 30% 18%",
    "accent-foreground": "203 85% 65%",

    destructive: "0 62% 55%",
    "destructive-foreground": "0 0% 100%",

    border: "210 15% 20%",
    input: "210 15% 20%",
    ring: "203 85% 55%",
  },
};
