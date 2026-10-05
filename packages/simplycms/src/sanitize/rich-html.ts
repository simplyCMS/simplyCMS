import sanitizeHtml, { type IOptions } from 'sanitize-html';
import type { SanitizedHtml } from 'simplycms/contracts';

/**
 * Профіль санітизації: який редактор породив розмітку.
 *
 * - `review` — `reviews-ui/ReviewRichTextEditor` (відгуки покупців; недовірений
 *   вхід, тому посилання отримують `nofollow ugc`);
 * - `content` — `admin/components/RichTextEditor` (описи розділів, опцій
 *   характеристик, товарів; автор — адмін, але рядок міг прийти зі сіду,
 *   імпорту чи легасі-запису).
 */
export type RichHtmlProfile = 'review' | 'content';

/**
 * 🔴 Білі списки ТОЧНО відповідають виводу Tiptap-конфігурацій редакторів
 * (звіряє `__tests__/rich-html-roundtrip.test.ts`, що генерує HTML справжніми
 * редакторами). Додати тег/атрибут «про запас» = розширити поверхню атаки.
 */
const REVIEW_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'code',
  'ul',
  'ol',
  'li',
  'a',
];
const CONTENT_TAGS = [
  ...REVIEW_TAGS,
  'h1',
  'h2',
  'h3',
  'blockquote',
  'pre',
  'hr',
  'img',
];

/** Класи, які Tiptap-конфігурації самі кладуть на вузли. */
const LINK_CLASSES = ['text-primary', 'underline', 'cursor-pointer'];
const IMG_CLASSES = ['max-w-full', 'h-auto', 'rounded-lg'];
/** `<code class="language-ts">` — клас мови кодового блока. */
const CODE_CLASSES = ['language-*'];

/** Токени `rel`, які лишаємо від автора (решта відкидається). */
const REL_TOKENS = new Set(['noopener', 'noreferrer', 'nofollow', 'ugc']);

/** Старі/сторонні теги, що мають точний відповідник у розмітці редактора. */
const TAG_ALIASES: Record<string, string> = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
};

const ALIGN = [/^(?:left|center|right|justify)$/];

function stripControl(value: string): string {
  // Керуючі символи й пробіли всередині схеми (`java\tscript:`) — класичний
  // обхід; для рішення «чи дозволений URL» їх прибираємо.
  return value.replace(/[\u0000- \u007f-\u009f]+/g, '');
}

function isAllowedHref(href: string, profile: RichHtmlProfile): boolean {
  const v = stripControl(href);
  if (/^(?:https?:\/\/|mailto:)/i.test(v)) return true;
  // Внутрішні посилання (`/catalog`) — лише в контенті адміна; `//host` — це
  // протокол-відносний зовнішній URL, не шлях.
  return profile === 'content' && /^\/(?!\/)/.test(v);
}

function isAllowedImgSrc(src: string): boolean {
  const v = stripControl(src);
  return /^https?:\/\//i.test(v) || /^\/media\//.test(v);
}

function isSmallInt(value: string | undefined): value is string {
  return value !== undefined && /^\d{1,5}$/.test(value);
}

/** `rel` для посилань: примусовий для відгуків, відфільтрований для контенту. */
function relFor(profile: RichHtmlProfile, rel: string | undefined): string {
  if (profile === 'review') return 'nofollow ugc noopener noreferrer';
  const kept = (rel ?? '')
    .split(/\s+/)
    .filter((token) => REL_TOKENS.has(token));
  for (const required of ['noopener', 'noreferrer']) {
    if (!kept.includes(required)) kept.push(required);
  }
  return kept.join(' ');
}

function buildOptions(profile: RichHtmlProfile): IOptions {
  const isContent = profile === 'content';
  return {
    allowedTags: isContent ? CONTENT_TAGS : REVIEW_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'class'],
      ol: ['start'],
      code: ['class'],
      ...(isContent
        ? {
            img: ['src', 'alt', 'title', 'width', 'height', 'class'],
            p: ['style'],
            h1: ['style'],
            h2: ['style'],
            h3: ['style'],
          }
        : {}),
    },
    allowedClasses: {
      a: LINK_CLASSES,
      code: CODE_CLASSES,
      ...(isContent ? { img: IMG_CLASSES } : {}),
    },
    // `style` — лише вирівнювання (TextAlign); будь-яка інша декларація, зокрема
    // `background:url(javascript:…)`, відкидається по одній.
    allowedStyles: isContent
      ? {
          p: { 'text-align': ALIGN },
          h1: { 'text-align': ALIGN },
          h2: { 'text-align': ALIGN },
          h3: { 'text-align': ALIGN },
        }
      : {},
    // Схеми — глобально; `data:`, `javascript:`, `vbscript:` тощо не входять.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    // Вміст заборонених тегів лишається текстом (екранованим), крім
    // script/style/textarea/option: їхній вміст sanitize-html відкидає цілком.
    disallowedTagsMode: 'discard',
    selfClosing: ['br', 'hr', 'img'],
    transformTags: {
      ...Object.fromEntries(Object.entries(TAG_ALIASES)),
      a: (tagName, attribs) => {
        const href = attribs.href;
        if (href === undefined || !isAllowedHref(href, profile)) {
          // Без дозволеного href посилання — просто текст (`span` не в білому
          // списку, тож тег відкидається, а вміст лишається).
          return { tagName: 'span', attribs: {} };
        }
        const out: Record<string, string> = { href };
        if (attribs.class) out.class = attribs.class;
        // Редактори пишуть `target="_blank"`; у відгуках (зовнішній автор)
        // ставимо його завжди, і завжди разом із безпечним `rel`.
        if (profile === 'review' || attribs.target === '_blank') {
          out.target = '_blank';
          out.rel = relFor(profile, attribs.rel);
        } else if (attribs.rel) {
          out.rel = relFor(profile, attribs.rel);
        }
        return { tagName, attribs: out };
      },
      ol: (tagName, attribs) => {
        const out: Record<string, string> = {};
        if (isSmallInt(attribs.start)) out.start = attribs.start;
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => {
        const out: Record<string, string> = {};
        if (attribs.src !== undefined && isAllowedImgSrc(attribs.src)) {
          out.src = attribs.src;
        }
        if (attribs.alt !== undefined) out.alt = attribs.alt;
        if (attribs.title !== undefined) out.title = attribs.title;
        if (isSmallInt(attribs.width)) out.width = attribs.width;
        if (isSmallInt(attribs.height)) out.height = attribs.height;
        if (attribs.class) out.class = attribs.class;
        return { tagName, attribs: out };
      },
    },
    // `<img>` без дозволеного `src` — порожня картинка; прибираємо цілком.
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  };
}

const OPTIONS: Record<RichHtmlProfile, IOptions> = {
  review: buildOptions('review'),
  content: buildOptions('content'),
};

/**
 * Санітизує розмітку rich-text редактора за профілем.
 *
 * 🔴 ЄДИНЕ місце, яке створює `SanitizedHtml`. Server-only (`sanitize-html`
 * не має потрапляти в клієнтський бандл): викликається при ЗАПИСІ (відгук,
 * generic-write адмін-ресурсу) і при ВІДДАЧІ клієнту (лоадери вітрини,
 * операції читання адмінки) — друге закриває старі рядки, сід і демо-дані.
 */
export function sanitizeRichHtml(
  html: string,
  profile: RichHtmlProfile,
): SanitizedHtml {
  return sanitizeHtml(html, OPTIONS[profile]) as SanitizedHtml;
}

/** `null` лишається `null` — колонки з розміткою nullable. */
export function sanitizeNullableRichHtml(
  html: string | null | undefined,
  profile: RichHtmlProfile,
): SanitizedHtml | null {
  return html == null ? null : sanitizeRichHtml(html, profile);
}
