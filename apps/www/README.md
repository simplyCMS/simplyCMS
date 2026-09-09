# apps/www — simplycms.dev

Статичний лендінг платформи SimplyCMS. TanStack Start у режимі пререндеру:
`pnpm build` рендерить сторінку в готовий HTML, деплой — будь-який статичний
хостинг. Це **private-застосунок** монорепо, не пакет ядра: реліз-потяг
(`bump.mjs`, `pnpm publish -r`) сканує лише `packages/*` і сюди не дотягується.

## Команди (з кореня монорепо)

```bash
pnpm dev:www        # dev-сервер на :3100 (магазин монорепо займає :3000)
pnpm build:www      # статичний білд → apps/www/dist/client/
pnpm typecheck:www  # tsc по застосунку (потребує routeTree.gen.ts — див. нижче)
```

`apps/www/src/routeTree.gen.ts` — генерат TanStack Router (комітиться, у
`.prettierignore` і eslint-ignore, як і host-овий).

## Живі метрики — механізм «не старіє через 1 коміт»

Сторінка НЕ запікає числа в білд. При відкритті браузер відвідувача сам тягне:

| Джерело | Ендпойнт | Що дає |
|---|---|---|
| GitHub API | `/repos/simplyCMS/simplyCMS` | зірки, форки |
| GitHub API | `/repos/…/languages` | % TypeScript у репо |
| npm registry | `/-/v1/search?text=simplycms` | список пакетів + версія + downloads/міс кожного |

Обидва API віддають CORS `*`; ліміт GitHub (60 req/год) витрачається з IP
відвідувача, кеш — sessionStorage на 30 хв. Агрегація — чисті функції в
`src/lib/live-stats.ts`, покриті `tests/www-live-stats.test.ts` у дефолтному
`pnpm test` монорепо. Фолбеки (`FALLBACK`) показуються лише до прибуття живих
значень (скелетони) або якщо API недоступні — тоді без позначки live.

## Деплой (simplycms.dev)

Артефакт — `apps/www/dist/client/` (статика + пререндерений `index.html`).

- **Vercel:** Root Directory `apps/www`, Build Command `pnpm build`,
  Output Directory `dist/client`.
- Будь-який інший статичний хостинг: віддати вміст `dist/client/` як docroot.

Шрифти self-hosted (`public/fonts/`, OFL: Bricolage Grotesque, Instrument
Serif, JetBrains Mono) — зовнішніх запитів за шрифтами/стилями немає.
