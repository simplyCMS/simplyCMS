// simplycms/addressing — серверне API реєстрів адрес і мовних токенів.
export { createPathsForEntity, currentPaths, setExplicitPath } from './paths';
export { currentPathOwners } from './owners';
export { createTokensForEntity, setExplicitToken } from './tokens';
export { PATH_KINDS, TOKEN_KINDS, pathSegmentOf } from './targets';
export type {
  AddressTarget,
  PathKindSpec,
  TokenKindSpec,
  TokenTarget,
} from './targets';
export { copyPathsForLocale, copyTokensForLocale } from './copy';
export { pathCandidates, tokenCandidates } from './copy-candidates';
export { PUBLIC_MANIFEST_PATH, publicNames } from './public-names';
