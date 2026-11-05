/** Transport-level server rejections (before the handler): request body ceiling. */
export const messages = {
  'errors.payloadTooLarge':
    'The files are too large: the total size exceeds the allowed limit. Reduce them and try again.',
} satisfies Record<string, string>;
