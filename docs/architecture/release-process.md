# Реліз ядра: публікація пакетів на npmjs

Ядро SimplyCMS — 21 пакет `@simplycms/*`, які публікуються на **npmjs** під
scope `@simplycms`. Цей документ описує, як випустити нову версію.

## Коротко

```bash
pnpm release 0.2.0          # гарди + бамп + гейти + коміт
git push -u origin release/v0.2.0
gh pr create --base main --title "Реліз v0.2.0"
# мерж у main → workflow publish-packages публікує на npmjs
```

---

## Модель версіонування

**Версія синхронна.** Усі 21 пакет завжди мають одну версію — споживач бачить
одне число «версія ядра» і не звіряє таблицю сумісності 21 пакета між собою.

Наслідок: підіймається версія **всім** пакетам, навіть тим, що не змінювались.
Це свідомий компроміс на користь простоти; незалежні версії (Changesets) —
можливий крок пізніше, коли пакети почнуть жити різними циклами.

Розходження версій між пакетами — **помилка стану**. `pnpm release` на неї
падає й вимагає спершу вирівняти (`pnpm version:packages X.Y.Z`), бо інакше
«поточна версія» невизначена.

## Що робить `pnpm release X.Y.Z`

| Крок | Що саме | Чому |
|------|---------|------|
| 1 | Гарди | версія у форматі `X.Y.Z` і **більша** за поточну; тег `vX.Y.Z` ще не існує; робоче дерево чисте |
| 2 | Гілка | якщо ми на `main` — відгалужується `release/vX.Y.Z`; інакше лишається поточна |
| 3 | Бамп | версія проставляється всім публікованим манифестам (`private: true` — пропускаються) |
| 4 | Гейти | повний канонічний набір; **перший червоний зупиняє реліз** |
| 5 | Коміт | `chore(release): vX.Y.Z` |

🔴 Скрипт **не пушить і не створює PR** — навмисно. Останній погляд на діф
лишається за людиною; автоматичний push зробив би реліз важко відкотним.

### Гейти релізу

Той самий порядок, що в `CLAUDE.md`:

```
install --frozen-lockfile → format:check → lint → build
→ typecheck → test → build:packages → test:packaging
```

`install --frozen-lockfile` перший, бо це єдиний гейт, що ловить розсинхрон
`pnpm-lock.yaml` з манифестами — у CI він дефолтний, тож розсинхрон валить
збірку ще до першого кроку.

## Що робить CI після мержу

Workflow `.github/workflows/publish-packages.yml`, тригер — **push у `main`**:

1. перевіряє наявність secret `NPM_TOKEN` (падає з підказкою, якщо немає);
2. `install --frozen-lockfile` → `build:packages`;
3. **tarball-parity** — гейт по розпакованих tarball-ах: перевіряє рівно те,
   що поїде в реєстр (усі `exports` вказують на наявні файли, нуль
   `workspace:` у dependencies);
4. `pnpm publish -r --access public --no-git-checks`.

**Мерж без бампа версії безпечний.** `pnpm publish -r` викликає
`isAlreadyPublished` і пропускає пакети, чия версія вже в реєстрі — тобто
звичайний мерж у `main` це тихий no-op, а не помилка. З тієї ж причини
безпечний ручний ретрай (`workflow_dispatch`) після прогону, що впав на
середині: вже опубліковані пакети другий раз не публікуються.

## Передумови (одноразові)

| Що | Де | Навіщо |
|----|----|--------|
| npm-організація `simplycms` | npmjs.com | scope пакетів мусить збігатися з іменем org **точно** |
| Secret `NPM_TOKEN` | GitHub → Settings → Secrets and variables → Actions | авторизація публікації |
| `publishConfig.access: "public"` | у кожному manifest-і | scoped-пакети npm за замовчуванням робить **приватними** (платний план) |

🔴 **Токен має бути Granular Access Token із увімкненим «Bypass 2FA»**
(Packages and scopes → `@simplycms`, permission **Read and write**).

Це не формальність, а перевірено падінням першого релізу (2026-08-03):
```
npm error code E403
403 Forbidden - PUT https://registry.npmjs.org/@simplycms%2fi18n
Two-factor authentication or granular access token with bypass 2fa enabled
is required to publish packages.
```
Токен без цієї опції автентифікується успішно (org і scope доступні), але
`PUT` пакета npm відхиляє. Помилка виглядає як проблема з правами на scope —
насправді це політика 2FA.

🔴 `registry-url` у `actions/setup-node` **обов'язковий**: без нього не
створюється `.npmrc`, і `NODE_AUTH_TOKEN` мовчки ігнорується. Класична причина
«токен є, а публікація каже 401».

## Історія: чому не GitHub Packages

До 2026-08-01 workflow публікував у **GitHub Packages** і був заглушений
`if: false`. Причина: GitHub Packages вимагає, щоб scope пакета збігався з
власником репозиторію, а після переносу репо в org `simplyCMS` scope
`@simplycms` перестав збігатися — публікація по тегу гарантовано падала з 403.

Замість латання перейшли на npmjs (spec §4.1). Старий шлях не відновлювати.

## Типові проблеми

| Симптом | Причина | Що робити |
|---------|---------|-----------|
| `402 Payment Required` при публікації | немає `access: "public"` — npm намагається зробити пакет приватним | додати `publishConfig.access` у manifest |
| `401` / `ENEEDAUTH` | немає `registry-url` у `actions/setup-node` — `.npmrc` не створився, і `NODE_AUTH_TOKEN` ігнорується | додати `registry-url` |
| `403 … bypass 2fa enabled is required` | токен без «Bypass 2FA» **(спіймано на першому релізі)** | пересоздати як Granular Access Token із увімкненим Bypass 2FA, оновити secret `NPM_TOKEN` |
| `403 Forbidden` без згадки 2FA | scope не збігається з іменем org, або акаунт не має права публікації в ній | `npm login && npm org ls simplycms` |
| `ERR_PNPM_OUTDATED_LOCKFILE` | `package.json` змінили, lockfile — ні | `pnpm install`, закомітити lockfile |
| Реліз-скрипт: «версії пакетів розійшлися» | хтось бампнув частину пакетів | `pnpm version:packages X.Y.Z`, тоді реліз |

## Пов'язане

- `scripts/release.mjs` + `scripts/release/{bump,gates,git}.mjs` — реалізація
- `scripts/version-packages.mjs` — «сирий» бамп без гейтів і коміту
- `.github/workflows/publish-packages.yml` — публікація
- `tests/published-exports-parity.test.ts` — tarball-parity гейт
- `CLAUDE.md` §CI/CD, §Публікація пакетів
