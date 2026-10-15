// gen.mjs — детермінований генератор синтетичного каталогу для моделі A + core.
// Пише в stdout потік psql (COPY ... FROM stdin) — на диск нічого не лягає.
// Використання: node gen.mjs <products> | docker exec -i ml-exp-pg psql -U postgres -q
//
// Пропорції (за ТЗ): ~3 модифікації на товар, 200 розділів (дерево 3 рівні),
// 300 властивостей, ~4000 опцій, ~15 значень на товар, 5 мов з неповними
// перекладами: en 90%, pl 50%, de 30%, ro 10% (решта — fallback на uk).

const N = Number(process.argv[2] ?? 50000);

// mulberry32 — щоб будь-хто відтворив той самий набір даних
let seed = 0x5eed1234 ^ N;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const hex = (n) => n.toString(16).padStart(8, '0');
function uuid() {
  const a = (rnd() * 2 ** 32) >>> 0,
    b = (rnd() * 2 ** 32) >>> 0,
    c = (rnd() * 2 ** 32) >>> 0,
    d = (rnd() * 2 ** 32) >>> 0;
  const h = hex(a) + hex(b) + hex(c) + hex(d);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const LOCALES = ['uk', 'en', 'pl', 'de', 'ro'];
const RATIO = { uk: 1, en: 0.9, pl: 0.5, de: 0.3, ro: 0.1 };
const SYL = {
  uk: [
    ['ко', 'ko'],
    ['ва', 'va'],
    ['ли', 'ly'],
    ['на', 'na'],
    ['ро', 'ro'],
    ['те', 'te'],
    ['ми', 'my'],
    ['ст', 'st'],
    ['пр', 'pr'],
    ['ук', 'uk'],
    ['ен', 'en'],
    ['ай', 'ai'],
    ['ор', 'or'],
    ['бу', 'bu'],
    ['ді', 'di'],
    ['жи', 'zhy'],
    ['зо', 'zo'],
    ['ки', 'ky'],
    ['лу', 'lu'],
    ['мо', 'mo'],
    ['ні', 'ni'],
    ['па', 'pa'],
    ['ре', 're'],
    ['си', 'sy'],
    ['то', 'to'],
    ['фу', 'fu'],
    ['хо', 'kho'],
    ['це', 'tse'],
    ['чи', 'chy'],
    ['ша', 'sha'],
    ['ює', 'yuie'],
    ['ял', 'yal'],
    ['ії', 'ii'],
    ['єр', 'yer'],
    ['ґа', 'ga'],
    ['ви', 'vy'],
    ['до', 'do'],
    ['ле', 'le'],
  ],
  en: [
    'ba',
    'co',
    'de',
    'fi',
    'ga',
    'ho',
    'in',
    'jo',
    'ka',
    'le',
    'mo',
    'ne',
    'or',
    'pi',
    'qu',
    'ra',
    'st',
    'te',
    'un',
    'vi',
    'we',
    'xa',
    'yo',
    'ze',
    'th',
    'er',
    'an',
    'sh',
    'ly',
    'ck',
  ].map((s) => [s, s]),
  pl: [
    ['ął', 'al'],
    ['ść', 'sc'],
    ['cz', 'cz'],
    ['rz', 'rz'],
    ['ło', 'lo'],
    ['ży', 'zy'],
    ['ów', 'ow'],
    ['ę', 'e'],
    ['ka', 'ka'],
    ['po', 'po'],
    ['wa', 'wa'],
    ['ni', 'ni'],
    ['sz', 'sz'],
    ['ma', 'ma'],
    ['do', 'do'],
    ['ki', 'ki'],
    ['le', 'le'],
    ['ro', 'ro'],
    ['ta', 'ta'],
    ['wy', 'wy'],
    ['ch', 'ch'],
    ['ze', 'ze'],
    ['bi', 'bi'],
    ['go', 'go'],
    ['mi', 'mi'],
  ],
  de: [
    ['sch', 'sch'],
    ['ei', 'ei'],
    ['ü', 'ue'],
    ['ö', 'oe'],
    ['ä', 'ae'],
    ['ß', 'ss'],
    ['ch', 'ch'],
    ['au', 'au'],
    ['en', 'en'],
    ['er', 'er'],
    ['ge', 'ge'],
    ['be', 'be'],
    ['st', 'st'],
    ['ung', 'ung'],
    ['keit', 'keit'],
    ['la', 'la'],
    ['mi', 'mi'],
    ['ra', 'ra'],
    ['to', 'to'],
    ['we', 'we'],
    ['ha', 'ha'],
    ['ku', 'ku'],
    ['li', 'li'],
    ['no', 'no'],
  ],
  ro: [
    ['ă', 'a'],
    ['î', 'i'],
    ['ș', 's'],
    ['ț', 't'],
    ['ea', 'ea'],
    ['oa', 'oa'],
    ['ui', 'ui'],
    ['re', 're'],
    ['ul', 'ul'],
    ['lor', 'lor'],
    ['ști', 'sti'],
    ['ție', 'tie'],
    ['ca', 'ca'],
    ['de', 'de'],
    ['ma', 'ma'],
    ['pe', 'pe'],
    ['ri', 'ri'],
    ['so', 'so'],
    ['tu', 'tu'],
    ['va', 'va'],
    ['bo', 'bo'],
    ['ne', 'ne'],
  ],
};
// Словник: 20 000 унікальних псевдослів на мову (2–4 склади), пара (відображення, ascii для slug)
const DICT = {};
for (const loc of LOCALES) {
  const seen = new Set();
  const w = [];
  const s = [];
  const syl = SYL[loc];
  while (w.length < 20000) {
    const k = ri(2, 4);
    let a = '',
      b = '';
    for (let i = 0; i < k; i++) {
      const p = syl[Math.floor(rnd() * syl.length)];
      a += p[0];
      b += p[1];
    }
    if (seen.has(a)) continue;
    seen.add(a);
    w.push(a);
    s.push(b);
  }
  DICT[loc] = { w, s };
}
// Zipf-подібний вибір: часті слова повторюються, як у реальних описах
// Назви: k=2.2 (рідкісніші, «іменні» слова). Тіло тексту: k=5 — топ-100 слів дають ~35% токенів,
// топ-1000 — ~55%, як у природній мові; інакше tsvector роздувається (усі лексеми унікальні).
const pick = (loc, k = 2.2) =>
  Math.floor(DICT[loc].w.length * Math.pow(rnd(), k));
function words(loc, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(DICT[loc].w[pick(loc, 5)]);
  return out.join(' ');
}
function title(loc, n) {
  const ix = [];
  for (let i = 0; i < n; i++) ix.push(pick(loc));
  const t = ix.map((i) => DICT[loc].w[i]).join(' ');
  return {
    text: t[0].toUpperCase() + t.slice(1),
    slug: ix.map((i) => DICT[loc].s[i]).join('-'),
  };
}
function html(loc) {
  return `<h2>${words(loc, 4)}</h2><p>${words(loc, 60)}.</p><p>${words(loc, 60)}.</p><ul><li>${words(loc, 6)}</li><li>${words(loc, 6)}</li><li>${words(loc, 6)}</li></ul><p>${words(loc, 45)}.</p>`;
}
// унікальність slug у межах (локаль, простір імен)
const slugSeen = new Map();
function uniq(ns, loc, slug) {
  const key = `${ns}|${loc}`;
  if (!slugSeen.has(key)) slugSeen.set(key, new Set());
  const set = slugSeen.get(key);
  let s = slug,
    k = 2;
  while (set.has(s)) s = `${slug}-${k++}`;
  set.add(s);
  return s;
}

const out = process.stdout;
const esc = (v) =>
  v === null || v === undefined
    ? '\\N'
    : String(v)
        .replace(/\\/g, '\\\\')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n');
const buf = [];
function flush(force) {
  if (force || buf.length > 2000) {
    out.write(buf.join(''));
    buf.length = 0;
  }
}
function copy(table, cols, rowsFn) {
  out.write(`COPY ${table} (${cols.join(',')}) FROM stdin;\n`);
  rowsFn((row) => {
    buf.push(row.map(esc).join('\t') + '\n');
    flush(false);
  });
  flush(true);
  out.write('\\.\n');
}
const translated = (loc) => loc === 'uk' || rnd() < RATIO[loc];

// ---------- розділи: 10 коренів × 5 дітей; 40 з них по 3 листки, 10 по 2 = 140 листків ----------
const sections = []; // {id, parent, depth, root}
for (let r = 0; r < 10; r++) {
  const root = { id: uuid(), parent: null, depth: 1, root: r };
  sections.push(root);
  for (let c = 0; c < 5; c++) {
    const l2 = { id: uuid(), parent: root.id, depth: 2, root: r };
    sections.push(l2);
    const kids = sections.filter((s) => s.depth === 2).length <= 40 ? 3 : 2;
    for (let k = 0; k < kids; k++)
      sections.push({ id: uuid(), parent: l2.id, depth: 3, root: r });
  }
}
const leaves = sections.filter((s) => s.depth === 3);
// перекошений розподіл товарів по листках (великі й малі розділи)
const lw = leaves.map((_, i) => 1 / Math.pow(i + 1, 0.6));
for (let i = lw.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [lw[i], lw[j]] = [lw[j], lw[i]];
}
const lwSum = lw.reduce((a, b) => a + b, 0);
const lcum = [];
lw.reduce((a, b, i) => (lcum[i] = a + b / lwSum), 0);
const pickLeaf = () => {
  const x = rnd();
  let i = lcum.findIndex((c) => c >= x);
  return leaves[i < 0 ? leaves.length - 1 : i];
};

copy(
  'a.sections',
  [
    'id',
    'slug',
    'name',
    'description',
    'parent_id',
    'sort_order',
    'meta_title',
    'meta_description',
  ],
  (emit) => {
    sections.forEach((s, i) => {
      const t = title('uk', 2);
      s.name = t;
      emit([
        s.id,
        uniq('sec', 'uk', t.slug),
        t.text,
        words('uk', 60),
        s.parent,
        i,
        t.text,
        words('uk', 20),
      ]);
    });
  },
);
copy(
  'a.section_translations',
  [
    'section_id',
    'locale',
    'name',
    'slug',
    'description',
    'meta_title',
    'meta_description',
  ],
  (emit) => {
    for (const s of sections)
      for (const loc of LOCALES.slice(1))
        if (translated(loc)) {
          const t = title(loc, 2);
          emit([
            s.id,
            loc,
            t.text,
            uniq('sec', loc, t.slug),
            words(loc, 60),
            t.text,
            words(loc, 20),
          ]);
        }
  },
);

// ---------- властивості: 30 на корінь (пули не перетинаються); 25 select, 5 number ----------
const props = [];
for (let r = 0; r < 10; r++)
  for (let k = 0; k < 30; k++) {
    const type = k < 25 ? (k % 12 === 11 ? 'multiselect' : 'select') : 'number';
    props.push({
      id: uuid(),
      root: r,
      type,
      filterable: type !== 'number' && rnd() < 0.75,
      options: [],
    });
  }
// 4000 опцій на 250 select-властивостей, розмір 3..60 зі скосом
const selectProps = props.filter((p) => p.type !== 'number');
const sizes = selectProps.map(() => 3 + Math.floor(57 * Math.pow(rnd(), 2.5)));
const scale = 4000 / sizes.reduce((a, b) => a + b, 0);
selectProps.forEach((p, i) => {
  const n = Math.max(3, Math.round(sizes[i] * scale));
  for (let k = 0; k < n; k++) p.options.push(uuid());
});
copy(
  'a.section_properties',
  ['id', 'name', 'slug', 'property_type', 'is_filterable', 'sort_order'],
  (emit) => {
    props.forEach((p, i) => {
      const t = title('uk', 2);
      emit([p.id, t.text, uniq('prop', 'uk', t.slug), p.type, p.filterable, i]);
    });
  },
);
copy(
  'a.section_property_translations',
  ['property_id', 'locale', 'name', 'slug'],
  (emit) => {
    for (const p of props)
      for (const loc of LOCALES.slice(1))
        if (translated(loc)) {
          const t = title(loc, 2);
          emit([p.id, loc, t.text, uniq('prop', loc, t.slug)]);
        }
  },
);
copy(
  'a.property_options',
  ['id', 'property_id', 'name', 'slug', 'sort_order'],
  (emit) => {
    for (const p of selectProps)
      p.options.forEach((o, i) => {
        const t = title('uk', ri(1, 2));
        emit([o, p.id, t.text, uniq('opt' + p.id, 'uk', t.slug), i]);
      });
  },
);
copy(
  'a.property_option_translations',
  ['option_id', 'locale', 'property_id', 'name', 'slug'],
  (emit) => {
    for (const p of selectProps)
      for (const o of p.options)
        for (const loc of LOCALES.slice(1))
          if (translated(loc)) {
            const t = title(loc, ri(1, 2));
            emit([o, loc, p.id, t.text, uniq('opt' + p.id, loc, t.slug)]);
          }
  },
);

// призначення: кожен листок — 17 товарних + 2 модифікаційні властивості з пулу свого кореня
const leafProps = new Map();
copy(
  'core.section_property_assignments',
  ['id', 'section_id', 'property_id', 'sort_order', 'applies_to'],
  (emit) => {
    for (const l of leaves) {
      const pool = props.filter((p) => p.root === l.root);
      const common = pool.slice(0, 5);
      const rest = pool
        .slice(5)
        .filter((p) => p.type !== 'multiselect' || rnd() < 0.5);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const prodProps = [...common, ...rest.slice(0, 12)];
      const modProps = rest
        .slice(12)
        .filter((p) => p.type === 'select')
        .slice(0, 2);
      leafProps.set(l.id, { prodProps, modProps });
      prodProps.forEach((p, i) => emit([uuid(), l.id, p.id, i, 'product']));
      modProps.forEach((p, i) =>
        emit([uuid(), l.id, p.id, 100 + i, 'modification']),
      );
    }
  },
);

copy(
  'core.price_types',
  ['id', 'code', 'name', 'is_default', 'sort_order'],
  (emit) => {
    emit([
      '00000000-0000-4000-8000-000000000001',
      'retail',
      'Роздрібна',
      true,
      0,
    ]);
    emit([
      '00000000-0000-4000-8000-000000000002',
      'wholesale',
      'Оптова',
      false,
      1,
    ]);
  },
);

// ---------- товари ----------
const products = [];
for (let i = 0; i < N; i++)
  products.push({ id: uuid(), leaf: pickLeaf(), mods: [] });
const optPick = (p) =>
  p.options[Math.floor(p.options.length * Math.pow(rnd(), 1.6))];
copy(
  'a.products',
  [
    'id',
    'section_id',
    'slug',
    'name',
    'short_description',
    'description',
    'is_active',
    'is_featured',
    'meta_title',
    'meta_description',
    'images',
    'sku',
    'stock_status',
    'created_at',
  ],
  (emit) => {
    for (const p of products) {
      const t = title('uk', 5);
      const imgs = JSON.stringify(
        Array.from({ length: ri(1, 4) }, () => `media/${uuid()}.webp`),
      );
      emit([
        p.id,
        p.leaf.id,
        uniq('prod', 'uk', t.slug),
        t.text,
        words('uk', 25),
        html('uk'),
        rnd() < 0.95,
        rnd() < 0.03,
        `${t.text} — ${words('uk', 2)}`,
        words('uk', 22),
        imgs,
        `SKU-${ri(100000, 999999)}`,
        rnd() < 0.85 ? 'in_stock' : 'out_of_stock',
        new Date(Date.UTC(2025, 0, 1) + ri(0, 600) * 86400000).toISOString(),
      ]);
    }
  },
);
copy(
  'a.product_translations',
  [
    'product_id',
    'locale',
    'name',
    'slug',
    'short_description',
    'description',
    'meta_title',
    'meta_description',
  ],
  (emit) => {
    for (const p of products)
      for (const loc of LOCALES.slice(1))
        if (translated(loc)) {
          const t = title(loc, 5);
          const full = rnd() < 0.9; // 10% перекладів — лише назва/slug (пополе fallback)
          emit([
            p.id,
            loc,
            t.text,
            uniq('prod', loc, t.slug),
            full ? words(loc, 25) : null,
            full ? html(loc) : null,
            full ? `${t.text} — ${words(loc, 2)}` : null,
            full ? words(loc, 22) : null,
          ]);
        }
  },
);
copy(
  'a.product_modifications',
  [
    'id',
    'product_id',
    'slug',
    'name',
    'sku',
    'is_default',
    'sort_order',
    'stock_status',
    'images',
  ],
  (emit) => {
    for (const p of products) {
      const n = ri(1, 5);
      for (let k = 0; k < n; k++) {
        const m = { id: uuid() };
        p.mods.push(m);
        const t = title('uk', 2);
        emit([
          m.id,
          p.id,
          `${t.slug}-${k}`,
          t.text,
          `SKU-${ri(100000, 999999)}-${k}`,
          k === 0,
          k,
          rnd() < 0.9 ? 'in_stock' : 'out_of_stock',
          '[]',
        ]);
      }
    }
  },
);
copy(
  'a.product_modification_translations',
  ['modification_id', 'locale', 'name'],
  (emit) => {
    for (const p of products)
      for (const m of p.mods)
        for (const loc of LOCALES.slice(1))
          if (translated(loc)) emit([m.id, loc, title(loc, 2).text]);
  },
);
copy(
  'core.product_property_values',
  ['id', 'product_id', 'property_id', 'value', 'numeric_value', 'option_id'],
  (emit) => {
    for (const p of products) {
      const { prodProps } = leafProps.get(p.leaf.id);
      const chosen = prodProps.filter((_, i) => i < 5 || rnd() < 10 / 12); // ~15 властивостей
      for (const pr of chosen) {
        if (pr.type === 'number')
          emit([uuid(), p.id, pr.id, null, (rnd() * 1000).toFixed(2), null]);
        else if (pr.type === 'multiselect') {
          const set = new Set();
          const k = ri(1, 3);
          for (let i = 0; i < k; i++) set.add(optPick(pr));
          for (const o of set) emit([uuid(), p.id, pr.id, null, null, o]);
        } else emit([uuid(), p.id, pr.id, null, null, optPick(pr)]);
      }
    }
  },
);
copy(
  'core.modification_property_values',
  [
    'id',
    'modification_id',
    'property_id',
    'value',
    'numeric_value',
    'option_id',
  ],
  (emit) => {
    for (const p of products) {
      const { modProps } = leafProps.get(p.leaf.id);
      for (const m of p.mods)
        for (const pr of modProps)
          emit([uuid(), m.id, pr.id, null, null, optPick(pr)]);
    }
  },
);
copy(
  'core.product_prices',
  [
    'id',
    'price_type_id',
    'product_id',
    'modification_id',
    'price',
    'old_price',
  ],
  (emit) => {
    for (const p of products)
      for (const m of p.mods) {
        const base = Math.round(100 + 20000 * Math.pow(rnd(), 3));
        emit([
          uuid(),
          '00000000-0000-4000-8000-000000000001',
          p.id,
          m.id,
          base,
          rnd() < 0.2 ? Math.round(base * 1.2) : null,
        ]);
        emit([
          uuid(),
          '00000000-0000-4000-8000-000000000002',
          p.id,
          m.id,
          Math.round(base * 0.85),
          null,
        ]);
      }
  },
);
