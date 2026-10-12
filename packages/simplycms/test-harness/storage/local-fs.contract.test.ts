import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localFsDriver } from 'simplycms/storage';
import { runDriverContract } from './contract';

runDriverContract('local-fs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'simplycms-contract-'));
  return {
    driver: localFsDriver(root),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
});
