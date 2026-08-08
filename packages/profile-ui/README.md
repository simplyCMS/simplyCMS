# @simplycms/profile-ui

React-компоненти особистого кабінету SimplyCMS: завантаження аватара в
Supabase Storage і повний CRUD збережених адрес та отримувачів. З них зібрана
канонічна сторінка `/profile/settings` у `@simplycms/storefront-routes`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/profile-ui
```

Peer-залежності: `react` (18/19), `@tanstack/react-query`,
`@tanstack/react-router`, `lucide-react`.

## Що всередині

| Експорт | Що це |
|---------|-------|
| `AvatarUpload` | Аватар користувача: прев'ю або ініціали, вибір файлу, видалення. Приймає `userId` + `currentAvatarUrl`, кладе файл у бакет `user-avatars` і віддає новий URL через `onUpdate` |
| `AddressesList` | Самодостатній список збережених адрес: створення, редагування, видалення, «за замовчуванням». Props не приймає — дані бере сам |
| `RecipientsList` | Те саме для отримувачів (ім'я, телефон, email, місто, адреса, нотатки) |
| `ProfileLayout` | Legacy-каркас профілю з бічною навігацією — див. застереження нижче |

Те саме доступне окремими subpath-ами (`exports` має `"./*"`):
`import { AddressesList } from '@simplycms/profile-ui/AddressesList'`.

## Приклад

Сторінка налаштувань профілю (`ProfileSettings` у
`@simplycms/storefront-routes`) монтує списки без пропсів, а аватару передає
дані вже завантаженого користувача:

```tsx
import { AvatarUpload, AddressesList, RecipientsList } from '@simplycms/profile-ui';

<AvatarUpload
  userId={user?.id || ''}
  currentAvatarUrl={avatarUrl}
  firstName={profileData?.first_name}
  lastName={profileData?.last_name}
  email={user?.email}
  onUpdate={setAvatarUrl}
/>
<AddressesList />
<RecipientsList />
```

## 🔴 Тут немає presentational-компонентів, а `ProfileLayout` застарів

Усі чотири експорти працюють лише всередині `QueryClientProvider` +
`SupabaseProvider` (у магазині їх ставить `CMSProvider`); `AddressesList`,
`RecipientsList` і `ProfileLayout` ще й беруть `useAuth` із legacy-фасаду
`@simplycms/core`. Підмінити рендер через props не вийде — розмітка власна.

`ProfileLayout` лишений тільки для зворотної сумісності й у репозиторії вже не
використовується: каркас профілю переїхав у ядро як `ProtectedShell`
(`@simplycms/storefront-routes`), який бере Header/Footer із теми й перекладає
підписи через `@simplycms/i18n`. У новому коді беріть `ProtectedShell` — теми
лейаутів більше не постачають (рішення D3/D4).

## Ліцензія

MIT
