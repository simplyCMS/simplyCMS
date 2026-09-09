import { GITHUB_URL } from './live-stats';

/** Усі зовнішні посилання лендінга — GitHub-репо, доки в ньому, npm. */
export const LINKS = {
  github: GITHUB_URL,
  issues: `${GITHUB_URL}/issues`,
  changelog: `${GITHUB_URL}/blob/main/CHANGELOG.md`,
  license: `${GITHUB_URL}/blob/main/LICENSE`,
  releases: `${GITHUB_URL}/tags`,
  docs: `${GITHUB_URL}/tree/main/docs`,
  howItWorks: `${GITHUB_URL}/blob/main/docs/how-it-works.md`,
  archSpec: `${GITHUB_URL}/blob/main/docs/superpowers/specs/2026-07-30-platform-architecture-design.md`,
  roadmap: `${GITHUB_URL}/blob/main/docs/tasks/platform-roadmap.md`,
  themesDoc: `${GITHUB_URL}/blob/main/docs/architecture/themes.md`,
  themesGuide: `${GITHUB_URL}/blob/main/docs/guides/themes.md`,
  pluginsDoc: `${GITHUB_URL}/blob/main/docs/architecture/plugins.md`,
  cliDoc: `${GITHUB_URL}/blob/main/docs/architecture/cli.md`,
  marketplaceDoc: `${GITHUB_URL}/blob/main/docs/marketplace/README.md`,
  testContours: `${GITHUB_URL}/blob/main/docs/architecture/test-contours.md`,
  npmOrg: 'https://www.npmjs.com/org/simplycms',
  // 🔴 Після К0 публікованих пакетів рівно пʼять. Колишній
  // `@simplycms/plugin-sdk` злитий у флагман і живе субшляхом
  // `simplycms/plugin-sdk` — окремого npm-пакета під нього більше немає.
  npmCore: 'https://www.npmjs.com/package/simplycms',
  npmScaffolder: 'https://www.npmjs.com/package/create-simplycms-store',
  npmCli: 'https://www.npmjs.com/package/@simplycms/cli',
  npmTheme: 'https://www.npmjs.com/package/@simplycms/theme-solarstore',
  npmPluginFaq: 'https://www.npmjs.com/package/@simplycms/plugin-faq',
} as const;

/** Атрибути зовнішнього посилання — щоб не розсипати по компонентах. */
export const EXT = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;
