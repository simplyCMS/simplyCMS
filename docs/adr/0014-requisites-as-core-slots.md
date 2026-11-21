# ADR-0014: Реквізити покупки — компоненти ядра, тема лише розставляє їх

Status: accepted 2026-08-17
Decided by: architect
Spec: `docs/architecture/themes.md` §2.1

## Context
View теми (ADR-0013) відтворює сторінку, де є кнопка купівлі, ціна, наявність. Якщо тема малює їх сама, вона може зламати воронку. Conformance тоді стає слабким. Потрібен спосіб, у якому логіка купівлі лишається в ядрі, а лейаут — у теми.

## Decision
View-model постачає реквізити як готові компоненти ядра в полі `slots`. На сторінці товару це `PriceBlock`, `StockBadge`, `ModificationSelector`, `AddToCart`, `StockAvailability`, `Reviews`; повний склад сторінок — типи `ProductDetailSlots`, `CatalogSlots`, `CartSlots`, `HomeSlots` (`packages/simplycms/src/contracts/views/requisites.ts`). Тема розставляє `<slots.X />` у своєму лейауті. Стилізація — лише appearance-пропси й токени. Кожен slot рендерить маркер `data-simplycms-requisite="<name>"`. Conformance перевіряє наявність маркера.

## Why
- Логіку купівлі, стани loading/error й інтеграцію з кошиком тема зламати не може: спека «theme-contract-v3-views-design», розділ «5. Slot-компоненти реквізитів» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Маркер робить асерт conformance тривіальним: спека «theme-contract-v3-views-design», розділ «5. Slot-компоненти реквізитів» (знесено 2026-11-21, текст — `git show 6daa49bc`).
- Атрибут є в коді: `REQUISITE_ATTRIBUTE = 'data-simplycms-requisite'` у `packages/simplycms/src/contracts/views/requisites.ts`.
- Реквізити сторінок: `packages/simplycms/src/contracts/README.md` § «Що всередині» (`REQUIRED_REQUISITES`).

## Rejected
- «Дані + колбеки, тема малює кнопку сама» — робить conformance слабким і дозволяє темі зламати покупку (спека «theme-contract-v3-views-design», розділ «5. Slot-компоненти реквізитів»; знесено 2026-11-21, текст — `git show 6daa49bc`).

## Consequences
Коректність воронки тримає ядро, а не автор теми. Автор теми не може змінити логіку кнопки, лише вигляд. Не віддавай темі «сирі» дані замість slot для комерційного реквізиту. Поле view-model додається, лише коли його споживає canonical view (правило YAGNI, спека «theme-contract-v3-views-design», розділ «4. View-model: принципи») (знесено 2026-11-21, текст — `git show 6daa49bc`).
