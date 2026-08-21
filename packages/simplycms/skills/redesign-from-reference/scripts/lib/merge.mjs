/**
 * Злиття кількох `inspection.json` в один синтетичний обʼєкт для `mapTokens`
 * (задача §2.D, план Р6/Р6b). Чиста функція, без IO — CLI-обгортка (Р6b,
 * `map-tokens.mjs`) читає файли й вирішує, чи взагалі викликати merge (при
 * N=1 — НЕ викликає, early return на чинний одновходовий шлях).
 *
 * Детермінізм незалежно від порядку вхідних файлів (Р6, «стабільні
 * сортування — перестановка вхідних файлів дає той самий результат») —
 * досягається глобальним сортуванням перед злиттям, а не порядком обходу
 * масиву `inspections`: сума/OR — комутативні операції, але порядок ключів у
 * вихідному масиві й вибір «представника» при нічиї інакше плавали б.
 */

/** Сума `frequency` усіх колірних семплів сторінки — вага для tie-break шрифтів. */
function pageColorFreqSum(inspection) {
  return (inspection.colors ?? []).reduce(
    (sum, c) => sum + (c.frequency ?? 0),
    0,
  );
}

/**
 * Злити кілька масивів колірних семплів (Р6): частоти й area сумуються по
 * парі (role,value), `interactive` — OR. Вхід спершу сортується глобально за
 * (role,value) — вихідний порядок Map-а тоді збігається з цим сортуванням
 * (перша поява ключа), незалежно від того, з якої сторінки й у якому порядку
 * прийшли семпли.
 */
function mergeColorSamples(colorArrays) {
  const flat = colorArrays.flat();
  const sorted = [...flat].sort((a, b) => {
    if (a.role !== b.role) return a.role < b.role ? -1 : 1;
    if (a.value !== b.value) return a.value < b.value ? -1 : 1;
    return 0;
  });

  const merged = new Map();
  for (const c of sorted) {
    const key = `${c.role}:${c.value}`;
    const existing = merged.get(key);
    if (existing) {
      existing.frequency += c.frequency ?? 0;
      existing.area += c.area ?? 0;
      existing.interactive = existing.interactive || Boolean(c.interactive);
    } else {
      merged.set(key, {
        role: c.role,
        value: c.value,
        frequency: c.frequency ?? 0,
        area: c.area ?? 0,
        interactive: Boolean(c.interactive),
      });
    }
  }
  return [...merged.values()];
}

/**
 * Голосування шрифтів по сторінках (Р6): кожен вхід — 1 голос за свій
 * `family`; перемагає більшість; при нічиї — сторінка з більшою сумою
 * колірних частот (`pageFreqSum`), далі лексикографічно за `family`. Вхід
 * спершу сортується (freqSum↓ → family → weight → sizePx) — «представник»
 * сімʼї (значення weight/sizePx у виводі) визначається цим сортуванням, а НЕ
 * порядком проходження сторінок.
 */
function voteFontConsensus(entries) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => {
    if (a.pageFreqSum !== b.pageFreqSum) return b.pageFreqSum - a.pageFreqSum;
    if (a.family !== b.family) return a.family < b.family ? -1 : 1;
    const aw = String(a.weight ?? '');
    const bw = String(b.weight ?? '');
    if (aw !== bw) return aw < bw ? -1 : 1;
    return (a.sizePx ?? 0) - (b.sizePx ?? 0);
  });

  const groups = new Map();
  for (const e of sorted) {
    const g = groups.get(e.family);
    if (g) g.count += 1;
    else groups.set(e.family, { count: 1, freqSum: e.pageFreqSum, entry: e });
  }

  const [, winner] = [...groups.entries()].sort(
    (a, b) =>
      b[1].count - a[1].count ||
      b[1].freqSum - a[1].freqSum ||
      (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  )[0];

  return {
    family: winner.entry.family,
    weight: winner.entry.weight,
    sizePx: winner.entry.sizePx,
  };
}

/** Витягти `fonts[key]` (`'heading'|'body'`) з кожної сторінки, що його має, + вагу для tie-break. */
function fontEntries(inspections, freqSums, key) {
  return inspections
    .map((insp, i) =>
      insp.fonts?.[key]
        ? { ...insp.fonts[key], pageFreqSum: freqSums[i] }
        : null,
    )
    .filter((e) => e !== null);
}

/**
 * Злити N `inspection.json`-подібних обʼєктів в один (Р6). Викликач
 * (`map-tokens.mjs`) передає результат прямо в `mapTokens`.
 */
export function mergeInspections(inspections) {
  const freqSums = inspections.map(pageColorFreqSum);

  const darkPages = inspections.filter(
    (insp) => insp.darkDetected && insp.dark?.colors,
  );

  // Р6: «конкатенація» — без сумування по valuePx (на відміну від кольорів);
  // сортування нижче — лише канонічний порядок виводу, детермінований
  // незалежно від порядку вхідних файлів (порядок ВСЕРЕДИНІ valuePx не
  // визначено — записи з тим самим valuePx зі сторінок не мержаться).
  const radius = inspections
    .flatMap((insp) => insp.radius ?? [])
    .sort((a, b) => a.valuePx - b.valuePx || b.frequency - a.frequency);

  return {
    colors: mergeColorSamples(inspections.map((insp) => insp.colors ?? [])),
    radius,
    fonts: {
      heading: voteFontConsensus(fontEntries(inspections, freqSums, 'heading')),
      body: voteFontConsensus(fontEntries(inspections, freqSums, 'body')),
    },
    fontStylesheets: [
      ...new Set(inspections.flatMap((insp) => insp.fontStylesheets ?? [])),
    ].sort(),
    darkDetected: inspections.some((insp) => Boolean(insp.darkDetected)),
    ...(darkPages.length > 0
      ? {
          dark: {
            colors: mergeColorSamples(
              darkPages.map((insp) => insp.dark.colors),
            ),
          },
        }
      : {}),
  };
}
