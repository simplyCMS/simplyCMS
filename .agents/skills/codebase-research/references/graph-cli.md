# graphify CLI — довідка для дослідження

Завантажуй, коли `.agents/skills/codebase-research/scripts/orient` не покриває сценарій: потрібна широка карта
незнайомої області, шлях між двома концептами або нетипові параметри обходу.

> Інсталяція, git-хуки, ізоляція від інших репо й обслуговування графа —
> команда `/граф-онови` (`.claude/commands/граф-онови.md`).
> Тут — лише запити до **готового** графа.

## Команди

```bash
graphify explain "<Символ>"                 # вузол: файл + рядок + прямі зв'язки
graphify affected "<Символ>" --depth 2      # зворотний обхід: кого зачепить зміна
graphify path "<A>" "<B>"                   # найкоротший шлях між двома вузлами
graphify query "Sym1 Sym2 Sym3" --budget 1500   # BFS-карта області
graphify query "…" --dfs                    # ланцюг замість широкого захвату
graphify update . --force                   # ребілд AST з видаленням зниклого (~1 хв)
```

`explain`/`affected`/`path` — по 0.4 с; `query` — ~0.5 с. Усі читають
`graphify-out/graph.json`, нічого не змінюють (окрім `update`).

## Як формулювати `query`

Матчер шукає **підрядок у мітках вузлів** (case-folded) + зважує IDF. Немає
стемінгу, синонімів і крос-мовного матчу. Наслідок:

| Погано | Чому | Добре |
| ------ | ---- | ----- |
| `"how does the storefront resolve the active theme"` | стартові вузли обираються за випадковими загальними словами | `"ThemeRegistry ThemeResolver getActiveThemeSSR"` |
| `"як рахується ціна зі знижкою"` | у мітках графа немає кирилиці | `"pricing discounts calculateTotal"` |

Мітки вузлів — це імена символів і файлів. Тому найкращий запит виглядає як
перелік 2–5 імен, які ти очікуєш побачити поруч.

Якщо все ж потрібне питання природною мовою — спершу звузь його до токенів, які
реально є в графі:

```bash
python3 - <<'PY'
import json, re
from pathlib import Path
d = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
vocab = set()
for n in d['nodes']:
    for chunk in re.findall(r'[^\W\d_]+', n.get('label', '') or '', re.UNICODE):
        for p in re.findall(r'[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+', chunk) or [chunk]:
            if 3 <= len(p) <= 30:
                vocab.add(p.lower())
Path('graphify-out/.vocab.txt').write_text('\n'.join(sorted(vocab)), encoding='utf-8')
print(len(vocab), 'токенів -> graphify-out/.vocab.txt')
PY
```

Далі бери з `.vocab.txt` до 12 токенів, які справді там є, і склей у запит.
Вигадувати токени, яких немає у словнику, — гарантований шум.

## Читання виводу

- `NODE <label> [src=<файл> loc=L<рядок> community=<N>]` — вузол.
- `EDGE A --relation [confidence]--> B` — зв'язок. `EXTRACTED` = знайдено AST-парсером
  (надійно), `INFERRED` = виведено семантично (перевіряй), `AMBIGUOUS` = здогад.
- `TRUNCATED: showing N of M` — підніми `--budget` або звузь запит.
- Релації `affected`: `imports`, `imports_from`, `re_exports`, `calls`,
  `indirect_call`, `references`, `extends`, `implements`, `uses`, `requires`.
  Саме `re_exports`/`imports_from` дають те, чого не бачить `grep`.

## Межі

Граф знає **структуру**: які символи існують, у яких файлах, хто кого імпортує й
кличе. Граф **не знає**: тіл функцій, значень полів типів, того, які саме моки
стоять у тесті, і чи тест справді щось перевіряє. Усе це — тільки читанням файлів.

`GRAPH_REPORT.md` — текстова мапа для людини: спільноти, god-nodes, несподівані
зв'язки. Корисна на старті знайомства з підсистемою, не для точкових питань.
