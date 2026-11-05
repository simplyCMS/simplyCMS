/**
 * Види цілей адрес (реєстри `url_paths` і `slug_tokens`): значення `kind` і `token_kind`.
 * Живуть у T1, бо їх читають і `addressing` (реєстр видів), і вітрина (резолвер адреси), якій
 * тір-зона забороняє імпорт `addressing`; один носій — розбіжності літералів бути не може.
 */
export const ADDRESS_KIND = {
  product: 'product',
  modification: 'modification',
} as const;

export type AddressKind = (typeof ADDRESS_KIND)[keyof typeof ADDRESS_KIND];
