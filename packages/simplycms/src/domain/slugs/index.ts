// simplycms/domain/slugs — адреси й токени (T1): ОДИН генератор slug для
// `url_paths` і `slug_tokens` (І22), службові сегменти (І19), вільний slug (І18).

export { SLUG_FORMAT, slugify, type LanguagePackSlugify } from './slugify';
export { allocateSlug } from './allocate';
export {
  RESERVED_QUERY_KEYS,
  RESERVED_SEGMENTS,
  isReservedPath,
  isReservedPropertyToken,
} from './reserved';
export { transliterateUk } from './translit-uk';
