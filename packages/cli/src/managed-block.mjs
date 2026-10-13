// Керований блок `AGENTS.md` магазину (Б §3.3, Е8-Р5): одна реалізація рендеру й
// застосування для `pnpm template:sync` (шаблонний `AGENTS.md`) і для `simplycms update`
// (наявні магазини). Дві копії логіки дали б два різні блоки — паритет тримає тест.

export const BLOCK_BEGIN =
  '<!-- simplycms:begin (керується `simplycms update`; текст поза маркерами — ваш) -->';
export const BLOCK_END = '<!-- simplycms:end -->';

/** Префікси маркерів: текст коментаря BEGIN може змінитись між версіями, а маркер лишається маркером. */
const BEGIN_PREFIX = '<!-- simplycms:begin';
const END_PREFIX = '<!-- simplycms:end';

/** Правило входу агента — частина блоку, а не вступу: вступ без нього ще й читає хук. */
const START_RULE =
  '**Почни з `pnpm simplycms status`** — він покаже етап магазину й наступний рекомендований скіл.';

/**
 * Блок між маркерами: вступ (`simplycms/agent/intro.md`) + правило старту.
 * @param {string} introMd
 */
export function renderManagedBlock(introMd) {
  return [BLOCK_BEGIN, introMd.trim(), '', START_RULE, BLOCK_END].join('\n');
}

/** Усі входження підрядка. */
function indexesOf(text, needle) {
  const found = [];
  for (
    let at = text.indexOf(needle);
    at !== -1;
    at = text.indexOf(needle, at + 1)
  )
    found.push(at);
  return found;
}

/**
 * Застосувати блок до тексту `AGENTS.md`. Текст поза маркерами — власника, тож
 * замінюється рівно діапазон BEGIN…END. Маркерів немає (чи файлу немає — `null`) →
 * `missing`; маркер один, два BEGIN, END перед BEGIN → `damaged`. В обох випадках
 * `next` немає: вгадувати, куди вставити блок, означало б ризикувати текстом власника.
 * @param {string | null} fileText
 * @param {string} block
 * @returns {{ status: 'ok' | 'drift' | 'missing' | 'damaged', next?: string }}
 */
export function applyManagedBlock(fileText, block) {
  if (fileText === null) return { status: 'missing' };
  const begins = indexesOf(fileText, BEGIN_PREFIX);
  const ends = indexesOf(fileText, END_PREFIX);
  if (begins.length === 0 && ends.length === 0) return { status: 'missing' };
  if (begins.length !== 1 || ends.length !== 1 || ends[0] < begins[0])
    return { status: 'damaged' };
  const close = fileText.indexOf('-->', ends[0]);
  if (close === -1) return { status: 'damaged' };
  const next =
    fileText.slice(0, begins[0]) + block + fileText.slice(close + '-->'.length);
  return { status: next === fileText ? 'ok' : 'drift', next };
}

/** Що робити, коли блок `missing`/`damaged`: update нічого не пише, лише пояснює. */
export const MANUAL_BLOCK_STEPS = [
  `Додай у AGENTS.md два маркери окремими рядками — там, де має стояти блок платформи:`,
  `  ${BLOCK_BEGIN}`,
  `  ${BLOCK_END}`,
  'Між маркерами нічого свого не пиши: цей діапазон перезаписує update. Потім:',
  'pnpm simplycms update',
];
