# @simplycms/plugins

Система плагінів SimplyCMS: реєстр хуків `HookRegistry`, завантажувач плагінів із
таблиці `plugins` і React-слот `PluginSlot`, у який плагіни вставляють власний UI
без правок ядра.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/plugins
```

## Що всередині

| Subpath                         | Експорти                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@simplycms/plugins`            | `hookRegistry`, `bootstrapPlugins`, `loadPlugins`, `activatePlugin`, `deactivatePlugin`, `uninstallPlugin` |
| `@simplycms/plugins`            | `getAllPlugins`, `installPlugin`, `updatePluginConfig`, 29 констант `HOOK_*` і `ALL_HOOKS`                 |
| `@simplycms/plugins/PluginSlot` | `PluginSlot`, `usePluginSlot`, `getPluginSlotCount`                                                        |
| `@simplycms/plugins/types`      | `PluginModule`, `PluginManifest`, `HookRegistryInterface`, `HookHandler`, `parsePlugin`                    |

## Приклад

Плагін чіпляє віджет на дашборд адмінки (`plugins/hello-world/index.ts`):

```ts
import type { HookRegistryInterface, PluginModule } from '@simplycms/plugins/types';

const plugin: PluginModule = {
  manifest,
  register(registry: HookRegistryInterface) {
    registry.register('admin.dashboard.widgets', 'hello-world', () =>
      createElement(HelloWorldWidget, { key: 'hello-world' }),
    );
  },
  unregister(registry: HookRegistryInterface) {
    registry.unregister('admin.dashboard.widgets', 'hello-world');
  },
};

export default plugin;
```

Ядро відкриває точку розширення слотом (`<PluginSlot name="admin.dashboard.widgets" />`),
а host підключає плагіни з `simplycms.config.ts` викликом
`bootstrapPlugins(config.plugins ?? [], supabase)`.

## 🔴 Слоти виконуються на клієнті

`PluginSlot` виконує хуки в ефекті й доки вони не резолвнулись — рендерить `null`,
тож у SSR-розмітці вмісту плагіна немає. Натомість слот підписаний на реєстр через
`useSyncExternalStore`, і `activatePlugin` / `deactivatePlugin` з адмінки додають
чи прибирають віджет живцем. Через це `@simplycms/plugins` і
`@simplycms/plugins/PluginSlot` мусять бачити **один** `hookRegistry`.

## Ліцензія

MIT
