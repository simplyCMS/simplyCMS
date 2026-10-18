// І37 у conformance: view картки товару, що показує fallback-фрагмент (поле, узяте з основної
// мови), мусить дати йому `lang` мови джерела. Канонічний view це робить, а тема з власним view —
// ні, якщо автор не знає правила (так було з темою `default`).
//
// 🔴 Перевірка ДИФЕРЕНЦІЙНА за даними фікстури, а не пошук тексту в розмітці: пошук підрядка
// сліпий до трансформованого чи розбитого тексту (`toUpperCase`, обрізання, підсвітка по слову),
// і тема без `lang` проходила вакуумно. Тут для кожного поля:
//   1. чи показує view це поле взагалі — розмітка змінюється, коли змінюється ЙОГО текст;
//   2. якщо показує — виставлення ЛИШЕ його `*_lang` мусить додати в розмітку елемент з `lang`.
import { productDetailFallbackFixture } from 'simplycms/contracts/views/fixtures';
import type {
  ProductDetailViewModel,
  ViewModelData,
} from 'simplycms/contracts/views';
import type { SanitizedHtml } from 'simplycms/contracts';

type Vm = ViewModelData<ProductDetailViewModel>;

/** Поле fallback: як підставити йому текст і мову (решта view-model — як у фікстурі). */
interface FallbackField {
  readonly field: string;
  readonly set: (vm: Vm, text: string, lang: string | null) => Vm;
}

const lastCrumb = (vm: Vm, text: string, lang: string | null): Vm => ({
  ...vm,
  breadcrumbs: vm.breadcrumbs.map((c, i) =>
    i === vm.breadcrumbs.length - 1 ? { ...c, label: text, lang } : c,
  ),
});

export const FALLBACK_FIELDS: readonly FallbackField[] = [
  {
    field: 'summary.name',
    set: (vm, text, lang) => ({
      ...vm,
      summary: { ...vm.summary, name: text, name_lang: lang },
    }),
  },
  {
    field: 'summary.short_description',
    set: (vm, text, lang) => ({
      ...vm,
      summary: {
        ...vm.summary,
        short_description: text,
        short_description_lang: lang,
      },
    }),
  },
  {
    field: 'description',
    set: (vm, text, lang) => ({
      ...vm,
      description: { html: `<p>${text}</p>` as SanitizedHtml, lang },
    }),
  },
  { field: 'breadcrumbs[last]', set: lastCrumb },
  {
    field: 'characteristics.value',
    set: (vm, text, lang) => ({
      ...vm,
      characteristics: {
        items: vm.characteristics.items.map((v, i) =>
          i === 0 ? { ...v, value: text, value_lang: lang } : v,
        ),
      },
    }),
  },
  {
    field: 'gallery.alt',
    set: (vm, text, lang) => ({
      ...vm,
      gallery: {
        images: vm.gallery.images.map((im, i) =>
          i === 0 ? { ...im, alt: text, alt_lang: lang } : im,
        ),
      },
    }),
  },
];

/** Мова джерела у фікстурі (усі fallback-поля фікстури — з основної мови). */
const SOURCE_LANG = productDetailFallbackFixture.summary.name_lang ?? 'uk';

/** Тексти-маркери: два різні значення кожного поля для перевірки «показує чи ні». */
const TEXT_A = 'fallback-fragment-a';
const TEXT_B = 'fallback-fragment-b';

/** Фікстура з усіма полями без `lang` і текстом `TEXT_A`: точка відліку диференціалу. */
export function fallbackBase(): Vm {
  return FALLBACK_FIELDS.reduce(
    (vm, f) => f.set(vm, TEXT_A, null),
    productDetailFallbackFixture as Vm,
  );
}

/** Знімок відрендереної розмітки: HTML і кількість елементів з `lang`. */
export interface Snapshot {
  readonly html: string;
  readonly langs: number;
}

export const snapshotOf = (root: HTMLElement): Snapshot => ({
  html: root.innerHTML,
  langs: root.querySelectorAll('[lang]').length,
});

/**
 * Поля, які view ПОКАЗУЄ, але не дає їм `lang`. `render` — рендер view-model у знімок
 * (conformance-kit підставляє справжній рендер теми).
 */
export async function missingFallbackLang(
  render: (vm: Vm) => Promise<Snapshot>,
): Promise<string[]> {
  const base = fallbackBase();
  const before = await render(base);
  const missing: string[] = [];
  for (const f of FALLBACK_FIELDS) {
    const changed = await render(f.set(base, TEXT_B, null));
    if (changed.html === before.html) continue; // поле view не показує
    const withLang = await render(f.set(base, TEXT_A, SOURCE_LANG));
    if (withLang.langs <= before.langs) missing.push(f.field);
  }
  return missing;
}
