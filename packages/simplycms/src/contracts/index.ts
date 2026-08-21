// simplycms/contracts — Tier 0 контракти об'єктів + порти.
// Type-only пакет: 0 runtime-залежностей, без імпортів supabase/react.
//
// 🔴 View-model-и вітрини (контракт тем v3) свідомо НЕ ре-експортуються
// звідси, а живуть окремим субшляхом `simplycms/contracts/views`: їхні
// slot-типи потребують `ComponentType` з react, і ре-експорт зробив би
// обіцянку «без імпортів react» у цьому барелі неправдою. React лишається
// опційним type-only peer-ом — runtime-залежностей пакет як не мав, так і
// не має.

export * from './objects/index';
export * from './ports/index';
