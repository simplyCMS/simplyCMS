#!/usr/bin/env python3
"""BM25-пошук теми людською мовою по корпусу доків — двигун `orient --map`.

Копія з MetaHub (`.agents/skills/codebase-research/scripts/map-search.py`),
адаптована під корпус SimplyCMS. Свідомо КОПІЯ, а не спільний пакет: зчеплення
двох репо гірше за розходження копій; змінюючи формулу, тримай коментар-обґрунтування
нижче. Параметри `K1`/`B` — заміри MetaHub (див. коментар біля `B`); на корпусі
SimplyCMS власного заміру ще немає — не рухати без нього.

Живий скан на кожен запит, без індексу й кроку збірки: корпус — кілька десятків
файлів, лематизація (за наявності) кешується в процесі.
"""

from __future__ import annotations

import collections
import math
import pathlib
import re
import subprocess
import sys

# --------------------------------------------------------------------- корпус
# Allowlist, а не blocklist: новий каталог документів не потрапляє у видачу
# мовчки — його додають свідомо. Скіли (`.agents/skills/**`) у корпус не входять:
# вони вантажаться за тригером опису, а не знаходяться пошуком.
INCLUDE_GLOBS = [
    "docs/architecture/**/*.md",
    "docs/development/**/*.md",
    "docs/guides/**/*.md",
    "docs/tasks/**/*.md",
    "AGENTS.md",
    "packages/README.md",
    # 🔴 docs/superpowers/{plans,specs} у корпусі НЕМАЄ навмисно: історія планів і
    # спек (тисячі рядків, кожен термін згаданий по десять разів) топить канон у видачі.
]

WORD = re.compile(r"[^\W\d_]+", re.UNICODE)
# 🔴 Відхилення від MetaHub (там 3): у SimplyCMS є доменні терміни з двох літер —
# `id` («Контракт id: ключ генерує викликач»), `ui`. При 3 запит «контракт id»
# зводився до одного слова «контракт», і канон про id програвав theme-контракту.
# Службові слова з 2 літер (та, не, на) шуму не додають — їх знецінює IDF.
MIN_TOKEN_LEN = 2

K1 = 1.5
B = 0.3  # ДРУГИЙ замір (перший — біля рядка з `b=0` — виявився
# упередженим): перший набір (9 пар) цілив у довгі SKILL.md, де b=0 не карав;
# другий (17 кейсів) — у короткі доменні доки, де довгий сусід із
# розпорошеними згадками (LIST_UI.md, 1770 токенів) систематично топив
# коротку ціль (SETTINGS_DICTIONARIES.md, 330 токенів) при b=0. На
# обʼєднаному наборі з 26 кейсів: b=0 → 17/26, b=0.3 і b=0.75 — по 19/26.
# Обрано b=0.3 — рівний b=0.75 на обʼєднаному, але менше шкодить довгим
# цілям (7/9 проти 6/9 на першому наборі). Компроміс за розподілом довжин
# цілей, НЕ «правильне значення» — далі не рухати без ТРЕТЬОГО заміру.

TOP_N = 10  # скільки файлів плоского ранжування взагалі потрапляють у вивід —
# і як топ-рівневі пункти, і як діти (рев'ю F1: раніше ліміт діяв лише на
# топ-рівневі слоти, а дітьми ставали ВСІ references показаного скіла без
# порога рангу — reference з підлоги корпусу міг витіснити з виводу вищий
# несуміжний док).

MAX_TRIGGER_LEN = 160  # це вказівник у терміналі, не документ (рев'ю F7):
# довгий абзац на кілька екранів гірший за легку втрату хвоста речення.


# ------------------------------------------------------------- лематизація
# pymorphy3 деградує до сирих токенів, якщо не встановлений (у cloud-сесіях
# його й не буде — це очікуваний робочий шлях, не аварія). Рівень
# позначається у виводі, а не мовчки підмінюється.
#
# Ловимо Exception, а не лише ImportError (рев'ю F6): пакет може імпортуватись,
# а `MorphAnalyzer(lang="uk")` — падати окремо (українські словники pymorphy3
# постачаються окремим дистрибутивом і відсутні за замовчуванням; несумісна
# версія словника падає так само). Вузький except ловив тільки відсутність
# самого пакета й мовчки клав увесь режим на будь-якій іншій причині.
try:
    import pymorphy3  # type: ignore

    _morph = pymorphy3.MorphAnalyzer(lang="uk")
except Exception:
    _morph = None

if _morph is None:
    LEMMA_LEVEL = "сирі токени"

    def lemma(word: str) -> str:
        return word

else:
    _lemma_cache: dict[str, str] = {}
    LEMMA_LEVEL = "леми"
    _m = _morph  # локальне імʼя для замикання — не покладаємось на global

    def lemma(word: str) -> str:
        if word not in _lemma_cache:
            _lemma_cache[word] = _m.parse(word)[0].normal_form
        return _lemma_cache[word]


def tokenize(text: str) -> list[str]:
    return [lemma(w.lower()) for w in WORD.findall(text) if len(w) >= MIN_TOKEN_LEN]


def repo_root() -> pathlib.Path:
    """Корінь репо — той самий спосіб, що в `orient`: git, не лічба `..`."""
    here = pathlib.Path(__file__).resolve()
    out = subprocess.run(
        ["git", "-C", str(here.parent), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    if out.returncode == 0 and out.stdout.strip():
        return pathlib.Path(out.stdout.strip())
    # запасний варіант — сам скрипт лежить у .agents/skills/codebase-research/scripts/
    return here.parents[4]


def collect_corpus(root: pathlib.Path) -> dict[pathlib.Path, collections.Counter]:
    files: set[pathlib.Path] = set()
    for pattern in INCLUDE_GLOBS:
        files.update(root.glob(pattern))

    index: dict[pathlib.Path, collections.Counter] = {}
    # Сортуємо: `set` ітерується в порядку хешу, а хеш рядків рандомізований
    # per-process (PYTHONHASHSEED) — без сорту порядок при рівних балах BM25
    # (а вони трапляються) був би недетермінованим між запусками.
    for f in sorted(files):
        rel = f.relative_to(root)
        if "assets" in rel.parts or "node_modules" in rel.parts:
            continue  # захисна поправка — див. коментар над INCLUDE_GLOBS
        try:
            text = f.read_text(encoding="utf-8")
        except OSError:
            continue
        index[rel] = collections.Counter(tokenize(text))
    return index


def bm25(query: str, index: dict[pathlib.Path, collections.Counter]) -> list[tuple[pathlib.Path, float]]:
    n = len(index)
    if n == 0:
        return []
    df: collections.Counter = collections.Counter()
    for counts in index.values():
        df.update(counts.keys())
    avgdl = sum(sum(c.values()) for c in index.values()) / n

    ql = tokenize(query)
    scores: dict[pathlib.Path, float] = {}
    for f, counts in index.items():
        dl = sum(counts.values())
        s = 0.0
        for t in ql:
            tf = counts.get(t)
            if not tf:
                continue
            idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
            # Стандартна BM25-нормалізація довжини: довший файл (більший dl
            # відносно середнього avgdl) отримує вищий знаменник, тобто
            # штрафується. При B=0.3 цей доданок ПРАЦЮЄ (на відміну від
            # знятого B=0.0) — це і є свідомий компроміс другого заміру,
            # обґрунтування — коментар біля константи B вище.
            s += idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * dl / avgdl))
        if s:
            scores[f] = s
    return sorted(scores.items(), key=lambda kv: -kv[1])


# ------------------------------------------------------------------- вивід
def skill_owner(rel: pathlib.Path) -> pathlib.Path | None:
    """Для `.agents/skills/<name>/references/<x>.md` — шлях до SKILL.md скіла."""
    p = rel.parts
    if len(p) >= 5 and p[0] == ".agents" and p[1] == "skills" and p[3] == "references":
        return pathlib.Path(p[0], p[1], p[2], "SKILL.md")
    return None


# Здебільшого тригер написаний жирним (`**Завантажуй, коли**`), але є виняток
# без жирного — беремо обидва варіанти, а не тільки більшість.
TRIGGER_RE = re.compile(r"\*{0,2}Завантажуй, коли\*{0,2}.*?(?=\n\s*\n|\Z)", re.DOTALL)


def extract_trigger(root: pathlib.Path, rel: pathlib.Path) -> str:
    """Тригер reference-файла — той, що вже написаний у файлі. Не вигадуємо."""
    try:
        text = (root / rel).read_text(encoding="utf-8")
    except OSError:
        return ""
    m = TRIGGER_RE.search(text)
    if not m:
        return ""
    return " ".join(line.strip() for line in m.group(0).strip().splitlines())


def clean_trigger(text: str) -> str:
    """Тригер — вказівник у терміналі, не markdown-джерело (рев'ю F7): без
    сирих `**` і без цілого абзацу, якщо той довший за розумний рядок."""
    text = text.replace("**", "")
    if len(text) > MAX_TRIGGER_LEN:
        text = text[:MAX_TRIGGER_LEN].rsplit(" ", 1)[0] + "…"
    return text


def build_report(theme: str, root: pathlib.Path) -> str:
    index = collect_corpus(root)
    # Зрізаємо до TOP_N ОДРАЗУ, до групування: групування нижче — лише спосіб
    # ПОКАЗУ вже відібраних файлів (структура «власник → його references»),
    # а не спосіб відбору. Дитина в дереві може бути лише той reference, який
    # сам потрапив у ці TOP_N; SKILL.md
    # підтягується нагору незалежно від власного балу — так власника видно
    # завжди, — але без права видавати за нього references поза TOP_N.
    ranked = bm25(theme, index)[:TOP_N]

    order: list[pathlib.Path] = []
    children: dict[pathlib.Path, list[pathlib.Path]] = collections.defaultdict(list)

    for f, _score in ranked:
        owner = skill_owner(f)
        slot = owner if owner is not None else f
        if slot not in order:
            order.append(slot)
        if owner is not None:
            children[slot].append(f)

    # Лічильник друкується ЗАВЖДИ — і на успішному прогоні, і на порожньому
    # результаті. Без нього «двигун упав» (F2) і «двигун відпрацював, збігів
    # немає» виглядають ІДЕНТИЧНО — порожній вивід. З лічильником порожній
    # результат читається як «просканував N файлів, жоден не підійшов»
    # (чесний нуль), а відсутність лічильника — як ознака збою.
    lines = [f"# orient --map: {theme}", f"# корпус: {len(index)} файлів"]
    if not order:
        lines.append("  (нічого не знайдено в корпусі доків — спробуй інші слова теми)")

    # Вирівнювання колонки «(рівень: …)» по найдовшому шляху серед топ-рівневих
    # пунктів (рев'ю F7: фіксовані 23 пробіли рвали колонку — шляхи корпусу
    # різняться на десятки символів).
    width = max((len(str(p)) for p in order), default=0) + 2

    # 🔴 §-якорів тут НЕМАЄ — і це навмисно, не недогляд:
    # BM25 рівня розділів усередині файла не міряє, тож друкувати
    # номер чи назву розділу як частину результату означало б видавати
    # нез'ясований збіг за ранжування. Якщо колись знадобиться — це МОЖЕ бути
    # лише якір усередині вже ОБРАНОГО файла (не самостійний критерій відбору)
    # і з явною міткою поруч, що це не результат BM25.
    for top_file in order:
        lines.append(f"{str(top_file):<{width}}(рівень: {LEMMA_LEVEL})")
        for child in children.get(top_file, []):
            trigger = clean_trigger(extract_trigger(root, child))
            suffix = f" ← {trigger}" if trigger else ""
            lines.append(f"   └ {child}{suffix}")
    lines.append("")
    lines.append("# Це вказівники. Зміст — читай у файлах.")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print('usage: map-search.py "<тема>"', file=sys.stderr)
        return 2
    theme = argv[1]
    root = repo_root()
    print(build_report(theme, root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
