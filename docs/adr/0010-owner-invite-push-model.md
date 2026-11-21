# ADR-0010: Перший адмін — запрошення з консолі розробника (`owner:invite`); роль після прийняття

Status: accepted 2026-08-03
Decided by: owner
Spec: `docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` §4

## Context
Магазин потребує першого адміна без вікна «хто перший зайшов, той і адмін».
Тригер `handle_new_user` у старій схемі робив першого користувача адміном.
Після переходу на Better Auth пошту не підтверджували, тож роль, видана до першого кліку, стала небезпечною.
Тому 2026-10-12 (Р19) власник уточнив момент видачі ролі.

## Decision
Розробник запускає в консолі `OWNER_EMAIL=… pnpm owner:invite`, коли схема вже накочена.
Власник отримує лист із одноразовим посиланням і встановлює пароль.
Роль `admin` видається лише після прийняття запрошення.
Прийняття й будь-яке скидання пароля гасять усі сесії користувача.

## Why
- Механізм push-моделі: `docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «4. Bootstrap власника: invite при деплої (push-модель».
- Амендмент Р19: самореєстрація на пошту власника до запрошення давала роль негайно; тепер роль видають після прийняття (`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «4.2. Чому це безпечно (модель загроз»).
- Публічного шляху «стати адміном» немає, скільки б часу не минуло між деплоєм і першим входом (`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «4.2. Чому це безпечно (модель загроз»).
- Код: `packages/create-simplycms-store/template/scripts/owner-invite.mjs` викликає `ownerInviteMain` з `simplycms/auth/owner-invite-cli`.

## Rejected
- Токен у URL — витікає через Referer, потребує стека мітигацій (`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «2.2. Безпека першого власника»).
- Сід-пароль з примусовою зміною — підходить лише системам із власним паролестором (`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «2.2. Безпека першого власника»).
- Перший зареєстрований стає адміном — жива діра в тригері `handle_new_user` (`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «2.3. Стан власного коду (аудит цієї сесії»).
- Pull-модель (`claim_owner()`) — свідомо не в першій версії (`docs/superpowers/specs/2026-08-03-create-store-owner-bootstrap-design.md` § «5. Опційне продовження (свідомо не v1): pull-модель»).

## Consequences
Для запрошення потрібен доступ розробника до консолі й БД магазину.
Реєстрація покупців лишається відкритою, призначення адмін-ролі — закритим.
Не можна повертати видачу ролі «до першого кліку» чи роль першому користувачу.
Скрипт `owner-invite.mjs` — файл каркаса під `simplycms update`: логіка живе в ядрі.
