/**
 * Мапінг ОДНОГО набору колір-семплів (світлого АБО темного) на підмножину
 * `ThemeTokenValues` (задача §2.B.1, план Р4/Р7). Спільна логіка для `tokens`
 * і `tokens.dark` — викликається з `map.mjs` двічі.
 *
 * Винесено окремо від `map.mjs`, щоб той лишався ≤150 рядків (канон файлу).
 */
import { contrastRatio, hslToRgb, hslTriple } from './color.mjs';
import { clusterColors } from './cluster.mjs';

/** Поріг насиченості (%), нижче якого колір вважають ахроматичним (не акцентом). */
const SAT_THRESHOLD = 20;
/** Мінімальна різниця lightness (%) між `background` і `card` — інакше це той самий колір. */
const MIN_CARD_GAP = 3;
const WHITE_HSL = { h: 0, s: 0, l: 100 };

function byRole(colors, role) {
  return colors.filter((c) => c.role === role);
}

/** Частка `count` від `total`, округлена до сотих (0 при порожньому знаменнику). */
function ratio(count, total) {
  return total > 0 ? Math.round((count / total) * 100) / 100 : 0;
}

/** Обрати білий чи «чорнильний» (текстовий) колір — той, що дає вищий контраст на `base`. */
function pickForeground(baseHsl, inkHsl) {
  const baseRgb = hslToRgb(baseHsl);
  const whiteRatio = contrastRatio(baseRgb, hslToRgb(WHITE_HSL));
  const inkRatio = inkHsl ? contrastRatio(baseRgb, hslToRgb(inkHsl)) : 0;
  return whiteRatio >= inkRatio ? WHITE_HSL : inkHsl;
}

/** Записати акцентний токен + його `-foreground` + опційний дзеркальний ключ (secondary↔accent). */
function applyAccent(tokens, key, cluster, fgHsl, mirrorKey) {
  tokens[key] = hslTriple(cluster.hsl);
  tokens[`${key}-foreground`] = hslTriple(pickForeground(cluster.hsl, fgHsl));
  if (mirrorKey) {
    tokens[mirrorKey] = tokens[key];
    tokens[`${mirrorKey}-foreground`] = tokens[`${key}-foreground`];
  }
}

/**
 * Мапити семпли → `{ tokens, confidence, unmapped }` (підмножина `ThemeTokenValues`).
 *
 * Явний JSDoc-тип — щоб TS (`allowJs`, споживання з `.test.ts`) не звужував
 * тип `tokens` до лише тих ключів, які видно у прямих присвоєннях: ключі,
 * дописані через `applyAccent` (динамічний `tokens[key] = …`), інакше
 * лишились би невидимими для структурної інференції.
 * @returns {{ tokens: Record<string, string>, confidence: Record<string, number>, unmapped: string[] }}
 */
export function mapColorTokens(colors) {
  const bgClusters = clusterColors(byRole(colors, 'background'));
  const textClusters = clusterColors(byRole(colors, 'text'));
  const borderClusters = clusterColors(byRole(colors, 'border'));
  const totalOf = (clusters) =>
    clusters.reduce((sum, c) => sum + c.frequency, 0);

  const tokens = {};
  const confidence = {};
  // `used` тримає ПОСИЛАННЯ на кластери, не рядкові значення: однаковий hex у
  // різних ролях (темний текст = темний фон секції) — це РІЗНІ кластери, і
  // дедуп за значенням мовчки губив би другий із них і з tokens, і з unmapped.
  const used = new Set();
  const pick = (clusters, predicate = () => true) =>
    clusters.find((c) => predicate(c) && !used.has(c)) ?? null;

  const bg = pick(bgClusters);
  if (bg) {
    tokens.background = hslTriple(bg.hsl);
    confidence.background = ratio(bg.frequency, totalOf(bgClusters));
    used.add(bg);
  }

  const fg = pick(textClusters);
  if (fg) {
    tokens.foreground = hslTriple(fg.hsl);
    confidence.foreground = ratio(fg.frequency, totalOf(textClusters));
    used.add(fg);
  }

  // «Насичений акцент на інтерактивних елементах → primary»; ring дзеркалить
  // primary. Акценти резервуються ДО card: інакше частотний CTA-колір (та сама
  // кнопка на кожній картці каталогу) діставався б card як «наступна
  // поверхня», і primary зникав би з пропозиції без сліду.
  const interactive = bgClusters.filter((c) => c.interactive);
  const primary = pick(
    bgClusters,
    (c) => c.interactive && c.hsl.s >= SAT_THRESHOLD,
  );
  if (primary) {
    applyAccent(tokens, 'primary', primary, fg?.hsl, null);
    tokens.ring = tokens.primary;
    confidence.primary = ratio(primary.frequency, totalOf(interactive));
    used.add(primary);
  }

  // «Другорядний → accent/secondary» — наступний насичений колір (без вимоги interactive).
  const secondary = pick(bgClusters, (c) => c.hsl.s >= SAT_THRESHOLD);
  if (secondary) {
    applyAccent(tokens, 'secondary', secondary, fg?.hsl, 'accent');
    confidence.secondary = ratio(secondary.frequency, totalOf(bgClusters));
    used.add(secondary);
  }

  const card = pick(bgClusters); // «поверхні → card»: наступна background-поверхня
  if (card && (!bg || Math.abs(card.hsl.l - bg.hsl.l) >= MIN_CARD_GAP)) {
    tokens.card = hslTriple(card.hsl);
    if (fg) tokens['card-foreground'] = hslTriple(fg.hsl);
    tokens.popover = tokens.card;
    if (fg) tokens['popover-foreground'] = tokens['card-foreground'];
    used.add(card);
  }

  const border = pick(borderClusters);
  if (border) {
    tokens.border = hslTriple(border.hsl);
    tokens.input = tokens.border;
    confidence.border = ratio(border.frequency, totalOf(borderClusters));
    used.add(border);
  }

  const unmapped = [...bgClusters, ...textClusters, ...borderClusters]
    .filter((c) => !used.has(c))
    .map((c) => c.value);

  return { tokens, confidence, unmapped };
}
