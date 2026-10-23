import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const CRAFT_SPACE_ID = '6606bf28-79b6-7415-c5c5-6d0a79f7f279';
const CANARY_NAME = 'med-jita-v51-canary';

export function makeCloudflareConfig(databaseId) {
  if (typeof databaseId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
    throw new Error('MED_JITA_D1_DATABASE_ID ausente ou inválido. Nenhuma publicação realizada.');
  }
  return {
    name: CANARY_NAME,
    main: 'worker/index.js',
    compatibility_date: '2026-10-23',
    workers_dev: true,
    d1_databases: [{ binding: 'DB', database_name: CANARY_NAME, database_id: databaseId }],
    vars: { CRAFT_SPACE_ID },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = makeCloudflareConfig(process.env.MED_JITA_D1_DATABASE_ID);
  await writeFile(new URL('../wrangler.json', import.meta.url),
    JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  console.log('Configuração de deploy canário gerada. Nenhuma credencial foi impressa.');
}
