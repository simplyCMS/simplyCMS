// Типи slot-компонентів комерційних реквізитів (контракт тем v3, спека §5).
//
// 🔴 Чому цей субшлях НЕ ре-експортується з барелю `@simplycms/objects`:
// тип прибінджeного компонента мусить бути `ComponentType` з react —
// структурний `(props) => unknown` JSX не приймає (TS2786: «not a valid JSX
// element type», бо `JSX.ElementType` вимагає повернення `ReactNode`), а
// `=> any` заборонений coding-style. Тому view-model-и живуть окремим
// субшляхом `@simplycms/objects/views`, і обіцянка барелю «без імпортів
// supabase/react» лишається правдою. React — type-only peer пакета:
// runtime-залежностей T0 як не мав, так і не має.

import type { ComponentType } from 'react';

/**
 * Пропси оформлення, які тема передає будь-якому slot-компоненту.
 *
 * Мінімальні свідомо: слот — це прибінджена ядром логіка (кошик, стани
 * loading/error, запити), тема впливає лише на його вигляд.
 */
export interface SlotAppearanceProps {
  className?: string;
}

/**
 * Прибінджений ядром компонент реквізиту. Тема його лише РОЗСТАВЛЯЄ у
 * своєму лейауті — зламати воронку покупки темою неможливо.
 */
export type SlotComponent<TProps = SlotAppearanceProps> = ComponentType<TProps>;
