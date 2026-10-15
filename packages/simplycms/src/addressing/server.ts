// simplycms/addressing — серверне API реєстрів адрес і мовних токенів.
export {
  createPathsForEntity,
  currentPaths,
  resolvePath,
  setExplicitPath,
} from './paths';
export type { AddressTarget } from './paths';
export {
  createTokensForEntity,
  resolveToken,
  setExplicitToken,
} from './tokens';
export type { TokenTarget } from './tokens';
export { copyPathsForLocale, copyTokensForLocale } from './copy';
export {
  PUBLIC_MANIFEST_PATH,
  publicNames,
  usePublicNamesRoot,
} from './public-names';
