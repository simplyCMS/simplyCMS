/**
 * Мапінг шрифтів `inspection.fonts` → `font-sans`/`font-heading` +
 * пропозиція `fonts`-stylesheet (Фаза 1, задача §2.B.1, план Р7).
 *
 * Винесено окремо від `map.mjs`, щоб той лишався ≤150 рядків (канон файлу) —
 * логіка суто про шрифти, кольорової математики тут немає.
 */

/** Витягти назву сімʼї з CSS font-stack (`"'Inter', sans-serif"` → `inter`). */
function familyOf(stack) {
  return stack.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
}

/**
 * Google Fonts stylesheet-и, у яких `family=`-параметр (`css`/`css2`-URL)
 * підтверджує одну з `families`. Без підтвердження сімʼя лишається лише у
 * font-stack (Р7: `fonts`-пропозиція ЛИШЕ з підтвердженням із
 * `fontStylesheets`) — саме тому інспекція окремо звітує `fontStylesheets`,
 * бо самих `getComputedStyle` недостатньо, щоб довести походження шрифту.
 */
function confirmedStylesheets(fontStylesheets, families) {
  const wanted = families.map(familyOf);
  const matches = [];

  for (const href of fontStylesheets ?? []) {
    let family;
    try {
      family = (new URL(href).searchParams.get('family') ?? '')
        .split(':')[0]
        .toLowerCase();
    } catch {
      continue; // Не URL або нерозпізнаний формат — чесно пропускаємо, не падаємо.
    }
    if (wanted.includes(family) && !matches.includes(href)) matches.push(href);
  }

  return matches;
}

/**
 * Мапити `inspection.fonts` (`heading`/`body`, кожен `{ family, weight?, sizePx? }`)
 * → `{ tokens: { 'font-sans'?, 'font-heading'? }, fonts: ThemeFontSource[] | null }`.
 *
 * `font-heading` додається лише якщо відрізняється від `font-sans` — інакше
 * теми і так успадковують `font-sans` для заголовків (без дублювання значення).
 */
export function mapFonts(inspection) {
  const heading = inspection.fonts?.heading?.family;
  const body = inspection.fonts?.body?.family;

  const tokens = {};
  if (body) tokens['font-sans'] = body;
  if (heading && heading !== body) tokens['font-heading'] = heading;

  const stylesheets = confirmedStylesheets(
    inspection.fontStylesheets,
    [body, heading].filter(Boolean),
  );

  return {
    tokens,
    fonts:
      stylesheets.length > 0
        ? stylesheets.map((stylesheet) => ({ stylesheet }))
        : null,
  };
}
