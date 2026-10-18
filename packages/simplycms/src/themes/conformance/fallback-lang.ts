// І37 у conformance: view картки товару на фікстурі з fallback-полями (`*_lang`) мусить
// дати кожному такому фрагменту `lang` мови джерела. Канонічний view це робить, а тема з власним
// view — ні, якщо автор не знає правила (так було з темою `default`): без перевірки тут кожен
// view, згенерований редизайном магазину, повторив би пропуск.
import { productDetailFallbackFixture } from 'simplycms/contracts/views/fixtures';

/** Фрагмент із фікстури: текст (чи `alt` фото) і мова, яку він мусить отримати. */
export interface LangExpectation {
  readonly field: string;
  readonly text: string;
  readonly lang: string;
  /** `alt` — шукати `img[alt]`, а не текстовий вузол. */
  readonly kind: 'text' | 'alt';
}

/**
 * Порушення: фрагмент без потрібного `lang` (`found` — мова, що стоїть замість; `null` — без
 * `lang`). Фрагмент, якого тема не показує, порушенням не є: І37 — про те, що в розмітці.
 */
export interface LangProblem {
  readonly expectation: LangExpectation;
  readonly found: string | null;
}

/** Очікування — з тієї самої фікстури, на якій рендериться view (одне джерело). */
export function fallbackLangExpectations(): LangExpectation[] {
  const f = productDetailFallbackFixture;
  const crumb = f.breadcrumbs[f.breadcrumbs.length - 1]!;
  const value = f.characteristics.items[0]!;
  const image = f.gallery.images[0]!;
  const text = (
    field: string,
    t: string | null | undefined,
    lang: string | null | undefined,
  ): LangExpectation => ({
    field,
    text: t ?? '',
    lang: lang ?? '',
    kind: 'text',
  });
  return [
    text('summary.name', f.summary.name, f.summary.name_lang),
    text(
      'summary.short_description',
      f.summary.short_description,
      f.summary.short_description_lang,
    ),
    // Вміст опису — текст HTML фікстури без тегів (вона — один абзац).
    text(
      'description',
      f.description.html?.replace(/<[^>]+>/g, ''),
      f.description.lang,
    ),
    text('breadcrumbs[last]', crumb.label, crumb.lang),
    text('characteristics.value', value.value, value.value_lang),
    { ...text('gallery.alt', image.alt, image.alt_lang), kind: 'alt' },
  ];
}

/** Мова найближчого предка з `lang` (включно з самим елементом). */
const langOf = (el: Element | null) =>
  el?.closest('[lang]')?.getAttribute('lang') ?? null;

/** Усі елементи розмітки, що несуть фрагмент очікування. */
function occurrences(
  root: HTMLElement,
  e: LangExpectation,
): (Element | null)[] {
  if (e.kind === 'alt')
    return [...root.querySelectorAll('img')].filter(
      (img) => img.getAttribute('alt') === e.text,
    );
  const found: (Element | null)[] = [];
  // 4 = NodeFilter.SHOW_TEXT: глобального `NodeFilter` поза DOM-середовищем немає.
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    if (n.nodeValue?.includes(e.text)) found.push(n.parentElement);
  return found;
}

/** Кожне входження кожного фрагмента мусить мати `lang` мови джерела. */
export function missingFallbackLang(
  root: HTMLElement,
  expectations: readonly LangExpectation[] = fallbackLangExpectations(),
): LangProblem[] {
  const problems: LangProblem[] = [];
  for (const e of expectations) {
    for (const el of occurrences(root, e))
      if (langOf(el) !== e.lang)
        problems.push({ expectation: e, found: langOf(el) });
  }
  return problems;
}
