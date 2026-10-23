# MED JITA · V57 | PostgreSQL staging gate

**Esta implementação ainda não é produção.** A V52 em Sites permanece a única base
autorizada dos históricos reais. Não transferir dados para o banco gratuito de ensaio.

## Código e execução

- `../source/`: interface original preservada, sem reconstrução visual.
- `../worker/runtime.js`: API original com perfis, notas, PIN, espelhamento Craft.
- `postgres-d1-adapter.mjs`: traduz o pequeno conjunto de SQL D1 utilizado
  pelo Worker para PostgreSQL; mantém revisão otimista e rejeita comandos fora do
  esquema `snapshots`.
- `server.mjs`: servidor HTTP com API original; começa **sem permissão de
  gravar** e não inicia sem conexão de banco e chave.
- `../migration/snapshot-transfer.mjs`: compara exportações completas,
  sem descriptografar valores; rejeita JSON truncado.

Construir o projeto da pasta `site-v51`:

```bash
npm install
npm run qa
node render-production/server.mjs
```

Variáveis privadas para ambiente **isolado**: `DATABASE_URL`,
`MED_JITA_MASTER_KEY` (64 hex aleatórios, diferente da chave real durante os
testes), `PORT`. Manter `MED_JITA_WRITE_ENABLED=false`. Opcionalmente usar
`CRAFT_API_BASE` e `CRAFT_SPACE_ID` somente no ambiente autorizado, nunca no
ensaio com perfis fictícios.

**Jamais configurar o novo ambiente com a chave original antes de ter banco
persistente, exportação íntegra e restauração testada.** O Postgres gratuito do
Render expira após 30 dias e não oferece backup gerenciado.

## Verificação obrigatória da chave após importar

Com o banco definitivo configurado e a chave original mantida apenas no cofre do serviço, executar **sem publicar histórico ou chave nos logs**:

```bash
node render-production/verify-key.mjs
```

A rotina exige os quatro perfis, valida AES-256-GCM usando o identificador como AAD, verifica formato e revisões e falha se qualquer histórico não puder ser descriptografado. A migração deve continuar bloqueada em caso de falha. O Craft é somente um espelho auxiliar: não presumir que seus números de revisão estão atualizados.

## Bloqueios para o corte de produção

1. Um banco durável com cópias de segurança independentes e recuperação testada.
2. Exportação integral dos registros `snapshots` do Sites sem truncamento
   (a listagem administrativa pode truncar o conteúdo, portanto NÃO é backup).
3. Conferência de `id`, `revision`, `payload` e `updated_at` para todos
   os registros, incluindo quatro históricos e metadados auxiliares.
4. Estratégia segura para reutilizar a chave original ou recriptografar com
   acesso autorizado, sem inserir chaves, PINs e conteúdo no repositório.
5. Testes ponta a ponta com dados fictícios: escrita, leitura, reinicialização,
   troca de perfil, PIN, concorrência, conflito 409, sincronização Craft.
6. Segunda exportação de controle ou congelamento breve das gravações após
   a primeira cópia, comparação de revisões e liberação explícita do corte.
7. Plano de reversão confirmado, mantendo o Sites original intacto.

**Estado atual:** somente o SQL, o gateway e testes de preflight são preparados.
Eles não executam a migração de dados.
