# @simplycms/storefront-routes

Роути вітрини SimplyCMS: тека `routes/` (файлові роути TanStack Router),
канонічні сторінки `src/pages/`, каркаси `src/shells/`, серверний шар
`src/server/` і SEO-генератори `src/seo/`.

## Пакування: `routes/` їде СИРЦЯМИ

У tarball потрапляють три корені — `dist`, `src`, `routes`:

| Що              | Як публікується        | Чому                                                                                                                                                    |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/**`        | зібраний `dist/**`     | звичайний код бібліотеки: ESM + `.d.ts` (tsup)                                                                                                            |
| `routes/**`     | **сирі `.tsx`**        | генератор роутів host-а (`virtualRouteConfig` + `@tanstack/router-generator`) **сканує файли**, а не імпортує модулі — зібраний бандл він прочитати не може |

Тому в `package.json`:

```jsonc
"files": ["dist", "src", "routes"],
"publishConfig": {
  "exports": {
    // …решта ключів — дзеркало на dist…
    "./routes/*": "./routes/*"   // ← БЕЗ dist, свідомо
  }
}
```

🔴 Правило: **export-ключ `./routes/*` ніколи не переводиться на `dist`.**
Те саме діє для `@simplycms/admin-routes`. Інваріант тримає packaging-suite
`tests/published-exports-parity.test.ts` (кожна ціль export-а мусить існувати
в tarball-і) — але сам напрямок «сирці, не dist» є архітектурним рішенням, а не
випадковістю збірки.

## Підключення в host-і

`routes.ts` магазину монтує теку пакета фізичним шляхом:

```ts
// routes.ts магазину, шлях відносний до `routesDirectory` (`src/routes`)
physical('', '../../node_modules/@simplycms/storefront-routes/routes');
```
