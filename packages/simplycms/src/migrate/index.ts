/**
 * 🔴 Server-only (contracts/server-only): накат міграцій із журналом
 * контрольних сум (К3-Е8, Е8-Р2). Одна реалізація для старту контейнера,
 * `simplycms db:apply`, харнесу `test:schema` і `db:demo`.
 *
 * Модуль відкриває ВЛАСНЕ з'єднання (`pg`) повз `withActor`: накат іде
 * власником схеми ще до того, як ролі й RLS існують, тож преамбула актора
 * тут неможлива за побудовою.
 */
export { listMigrationFiles, type MigrationFile } from './files';
export {
  applyMigrations,
  MIGRATION_LOCK_KEY,
  type ApplyOptions,
  type ApplyReport,
} from './apply';
export { scramSha256Verifier } from './scram';
export {
  readJournal,
  pendingMigrations,
  type JournalRow,
  type ReadJournalOptions,
} from './journal';
export { readStoreFacts, type StoreFacts } from './store-facts';
export type { RuntimeReadOptions } from './runtime-read';
export { findForeignDatabases } from './cluster';
export {
  MigrationChecksumError,
  UnjournaledDatabaseError,
  MigrationTransactionControlError,
} from './errors';
