/**
 * Env процесу без `NODE_PATH`: pnpm ставить його на `.pnpm/node_modules` монорепо, і з
 * ним `jsdom`/`vite`/чужий CLI резолвляться навіть у голому скаффолді — смоук був би
 * зелений на брехні (у магазині користувача цієї змінної немає).
 * @returns {NodeJS.ProcessEnv}
 */
export function envWithoutNodePath() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== 'NODE_PATH'),
  );
}
