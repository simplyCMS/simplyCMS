# @simplycms/admin-routes

Файлові роути адмінки SimplyCMS — тонкі обгортки над сторінками
`@simplycms/admin`.

## Пакування: тільки сирці, без `dist`

Пакет **не збирається**: у ньому немає `src/`, лише тека `routes/` з
`.tsx`-файлами роутів. Генератор роутів host-а
(`virtualRouteConfig` + `@tanstack/router-generator`) **сканує файли**, а не
імпортує модулі, тому зібраний бандл йому не підходить.

```jsonc
"files": ["routes"],
"publishConfig": {
  "exports": { "./routes/*": "./routes/*" }   // ← БЕЗ dist, свідомо
}
```

🔴 Правило: **export-ключ `./routes/*` ніколи не переводиться на `dist`.**
Те саме діє для `@simplycms/storefront-routes` (там, крім `routes/`, є ще
звичайний зібраний `src/` → `dist/`).

## Підключення в host-і

```ts
// routes.ts магазину, шлях відносний до `routesDirectory` (`src/routes`)
physical('', '../../node_modules/@simplycms/admin-routes/routes');
```
