import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const templateUrl = new URL('../wrangler.portable.example.toml', import.meta.url);
const outputUrl = new URL('../wrangler.toml', import.meta.url);
const id = (process.env.MED_JITA_D1_DATABASE_ID || '').trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  throw Error('Configure MED_JITA_D1_DATABASE_ID com um UUID real do D1. Nada foi publicado.');
}
const source = await readFile(fileURLToPath(templateUrl), 'utf8');
if (!source.includes('COLE_AQUI_O_ID_DO_SEU_BANCO_D1')) throw Error('Marcador do D1 não encontrado.');
await writeFile(fileURLToPath(outputUrl), source.replace('COLE_AQUI_O_ID_DO_SEU_BANCO_D1', id));
console.log('Configuração portátil gerada sem incluir chaves privadas.');
