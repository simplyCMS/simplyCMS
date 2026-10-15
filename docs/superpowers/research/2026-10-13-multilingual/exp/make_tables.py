#!/usr/bin/env python3
"""make_tables.py <scale> — markdown-таблиці з results/<scale>/*.csv (для звіту)."""
import csv, json, re, sys
from collections import defaultdict

S = sys.argv[1]
D = f'results/{S}'
def load(n):
    return list(csv.DictReader(open(f'{D}/{n}.csv', encoding='utf-8')))

summ = load('summary')
idx = {(r['model'], r['test'], r['variant'], r['locale']): r for r in summ}
def cell(m, t, v, loc, f='warm_median_ms'):
    r = idx.get((m, t, v, loc))
    if not r or r[f] in ('', None): return '—'
    x = float(r[f])
    return f'{x:.2f}' if x < 100 else f'{x:.0f}'
def hits(m, t, v, loc):
    r = idx.get((m, t, v, loc))
    return '—' if not r else f"{float(r['hit_median']):.0f}"

out = []
P = out.append
MODELS_R = ['A', 'B', 'D', 'R', 'R2']

P(f'### PDP (масштаб {S}) — мс, медіана теплих / холодний; buffers (hit) теплий')
P('| модель | uk | en | de | з них планування (de) | de холодний | de buffers |')
P('|---|---|---|---|---|---|---|')
for m in ['A', 'B', 'D', 'D-gin', 'A+slugreg', 'A(ф2)']:
    P(f"| {m} | {cell(m,'pdp','-','uk')} | {cell(m,'pdp','-','en')} | {cell(m,'pdp','-','de')} | {cell(m,'pdp','-','de','plan_ms')} | {cell(m,'pdp','-','de','cold_ms')} | {hits(m,'pdp','-','de')} |")

for loc in ('de', 'en'):
    P(f'\n### Лістинг: 24 товари, локаль {loc} — мс (медіана теплих); у дужках buffers hit')
    P('| розділ / сортування / фільтри | ' + ' | '.join(MODELS_R + ['A(ф2)']) + ' |')
    P('|---|' + '---|' * (len(MODELS_R) + 1))
    for lv in ('L1', 'L2', 'L3'):
        for t in ('list_price', 'list_name'):
            for fv in ('f0', 'f3'):
                v = f'{lv}/{fv}'
                P(f"| {lv} {t.replace('list_','за ')} {fv} | " + ' | '.join(f"{cell(m,t,v,loc)} ({hits(m,t,v,loc)})" for m in MODELS_R + ['A(ф2)']) + ' |')

    P(f'\n### Фасети (8 властивостей), локаль {loc} — мс; у дужках buffers hit')
    P('| розділ / фільтри | ' + ' | '.join(MODELS_R + ['A(ф2)']) + ' |')
    P('|---|' + '---|' * (len(MODELS_R) + 1))
    for lv in ('L1', 'L2', 'L3'):
        for fv in ('f0', 'f1', 'f3'):
            v = f'{lv}/{fv}'
            P(f"| {lv} {fv} | " + ' | '.join(f"{cell(m,'facets',v,loc)} ({hits(m,'facets',v,loc)})" for m in MODELS_R + ['A(ф2)']) + ' |')

P('\n### Сторінка розділу = лістинг за ціною + фасети (de), мс')
P('| розділ / фільтри | ' + ' | '.join(MODELS_R) + ' |')
P('|---|' + '---|' * len(MODELS_R))
for lv in ('L1', 'L2', 'L3'):
    for fv in ('f0', 'f3'):
        vals = []
        for m in MODELS_R:
            a = idx.get((m, 'list_price', f'{lv}/{fv}', 'de')); b = idx.get((m, 'facets', f'{lv}/{fv}', 'de'))
            vals.append(f"{float(a['warm_median_ms']) + float(b['warm_median_ms']):.2f}" if a and b else '—')
        P(f'| {lv} {fv} | ' + ' | '.join(vals) + ' |')

P('\n### Пошук (FTS ∪ триграми, RRF, фасети, топ-24) — мс; для A гідрація 24 карток — окремим запитом (остання колонка, A / B / D)')
SM = ['A', 'A(sd-rebuilt)', 'A+locidx', 'R2', 'R2+locidx', 'R']
P('| запит / локаль | ' + ' | '.join(SM) + ' | гідрація A / B / D |')
P('|---|' + '---|' * (len(SM) + 1))
for kind in ('narrow', 'broad'):
    for loc in ('uk', 'en', 'de'):
        P(f"| {kind} {loc} | " + ' | '.join(cell(m, 'search', kind, loc) for m in SM) +
          f" | {cell('A','hydrate','-',loc)} / {cell('B','hydrate','-',loc)} / {cell('D','hydrate','-',loc)} |")

P('\n### Sitemap (усі активні товари + alternates) — мс (медіана 5 теплих)')
P('| модель | uk | en | de |')
P('|---|---|---|---|')
for m in MODELS_R + ['A(ф2)']:
    P(f"| {m} | {cell(m,'sitemap','-','uk')} | {cell(m,'sitemap','-','en')} | {cell(m,'sitemap','-','de')} |")

# ---------- записи ----------
wr = load('writes')
P('\n### Записи — час і WAL')
P('| тест | модель | n | мс (медіана) | WAL (медіана) | зачеплені таблиці (ins/upd/hot/del) |')
P('|---|---|---|---|---|---|')
def fmt_wal(b):
    b = float(b)
    return f'{b/1048576:.1f} МБ' if b > 1048576 else f'{b/1024:.1f} КБ'
order = ['upd_tr_en', 'upd_base_uk', 'upd_stock_1', 'upd_slug_1', 'add_locale_10k', 'add_locale_idx4', 'sd_refresh_en', 'sd_add_locale_cs',
         'price_mass', 'stock_mass', 'full_rebuild']
for t in order:
    for r in sorted([r for r in wr if r['test'] == t], key=lambda r: r['model']):
        tch = json.loads(r['touched']) if r['touched'] else {}
        ts = ', '.join(f"{k}: {v['ins']}/{v['upd']}/{v['hot']}/{v['del']}" for k, v in sorted(tch.items()))
        P(f"| {t} | {r['model']} | {r['n']} | {float(r['ms_median']):.2f} | {fmt_wal(r['wal_bytes_median'])} | {ts}{' — ' + r['note'] if r['note'] else ''} |")

# ---------- розміри ----------
sz = load('sizes')
# a/b/d і core (крім search_documents) — з чистого прогону одразу після побудови (36_clean_sizes.sh):
# у run_all розміри фази 3 включають роздуття від відкочених масових тестів
try:
    clean = load('sizes_p1_clean')
    keep = [r for r in sz if not (r['schema'] in ('a', 'b', 'd') or (r['schema'] == 'core' and r['rel'] != 'search_documents'))]
    sz = keep + clean
except FileNotFoundError:
    pass
P('\n### Розміри (heap / TOAST / індекси / разом), МБ')
P('| схема.таблиця | рядків | heap | TOAST | індекси | разом | індексів |')
P('|---|---|---|---|---|---|---|')
tot = defaultdict(lambda: [0, 0, 0, 0, 0])
for r in sorted(sz, key=lambda r: (r['schema'], -int(r['total']))):
    mb = lambda x: f'{int(x)/1048576:.1f}'
    tot[r['schema']][0] += int(r['heap']); tot[r['schema']][1] += int(r['toast']); tot[r['schema']][2] += int(r['idx']); tot[r['schema']][3] += int(r['total']); tot[r['schema']][4] += int(r['n_idx'])
    if int(r['total']) > 1048576 * (1 if S == '50000' else 0.1):
        P(f"| {r['schema']}.{r['rel']} | {int(float(r['rows']))} | {mb(r['heap'])} | {mb(r['toast'])} | {mb(r['idx'])} | {mb(r['total'])} | {r['n_idx']} |")
P('\n| схема | heap | TOAST | індекси | разом | індексів |')
P('|---|---|---|---|---|---|')
for k, v in sorted(tot.items()):
    P(f'| {k} | {v[0]/1048576:.1f} | {v[1]/1048576:.1f} | {v[2]/1048576:.1f} | {v[3]/1048576:.1f} | {v[4]} |')

col = load('collisions')
P('\n### Колізії slug')
P('| модель | сценарій | результат | деталь |')
P('|---|---|---|---|')
for r in sorted(col, key=lambda r: (r['model'], r['scenario'])):
    P(f"| {r['model']} | {r['scenario']} | {r['outcome']} | {(r['detail'] or '')[:110]} |")

q = load('queries')
P('\n### Складність запитів: кількість JOIN (усіх видів) у шаблоні')
tests = ['pdp', 'list_price', 'list_name', 'facets', 'search', 'hydrate', 'sitemap']
P('| модель | ' + ' | '.join(tests) + ' |')
P('|---|' + '---|' * len(tests))
qi = {(r['model'], r['test']): r['sql'] for r in q}
for m in ['A', 'B', 'D', 'D-gin', 'A+slugreg', 'R', 'R2']:
    P(f'| {m} | ' + ' | '.join(str(len(re.findall(r'\bJOIN\b', qi[(m, t)]))) if (m, t) in qi else '—' for t in tests) + ' |')

eq = load('equiv')
bad = [r for r in eq if int(r['distinct_results']) > 1]
P(f"\nЕквівалентність результатів: перевірено {len(eq)} комбінацій (тест×параметри), розбіжностей: {len(bad)} "
  + (f"({', '.join(r['test'] + ':' + r['variant'] for r in bad)})" if bad else ''))
open(f'tables_{S}.md', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('\n'.join(out))
