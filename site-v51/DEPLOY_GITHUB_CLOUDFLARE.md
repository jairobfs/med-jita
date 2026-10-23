# MED JITA V51 — GitHub → Cloudflare Workers (canário)

O GitHub passa a ser a **origem do código**. O Cloudflare Workers executará a aplicação V51 com D1, sem depender da Vercel ou de um domínio que contenha `chatgpt.site`. Esta preparação ainda **não muda o aplicativo em produção**.

## Implantação automática preparada

O workflow `.github/workflows/deploy-v51-worker.yml` é executado em commits de `main` que alterem `site-v51/` (ou manualmente). Sua etapa de publicação **somente é ativada** quando a variável do repositório `MED_JITA_CANARY_ENABLED` vale `true`. Enquanto a variável não existir, nada é criado na Cloudflare.

Antes de ativar, criar uma conta/projeto Cloudflare e um **banco D1 de teste, vazio**, com nome `med-jita-v51-canary`. No ambiente de GitHub Actions `med-jita-canary`, definir estes *secrets*:

| Nome | Conteúdo |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token limitado às permissões necessárias de Workers e D1. |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare. |
| `MED_JITA_D1_DATABASE_ID` | UUID do D1 de teste (não usar o banco de produção). |
| `CRAFT_API_BASE` | URL privada da conexão Full Space API de `⌯ MED`. |
| `MED_JITA_MASTER_KEY` | Chave hexadecimal de 256 bits para o **novo** ambiente. Guardar com segurança. |

A conexão Craft só funciona quando pertence ao espaço fixado pelo código (`6606bf28-79b6-7415-c5c5-6d0a79f7f279`). O workflow mantém esse identificador e injeta as duas credenciais sensíveis como secrets, sem colocá-las no código.

## Segurança da migração

- **Não usar a V51 canário para notas reais.** Ela utiliza outro banco. O workflow testa apenas rotas de leitura.
- O código da V51 e o GitHub Pages/V6 ficam preservados na mesma versão do repositório; o deploy do Pages não é substituído por este workflow.
- O histórico de usuários existente no ambiente anterior **não é transferido automaticamente**. A migração deve preservar as revisões e a chave de cifragem apropriada; trocar a chave sem recriptografar inviabiliza ler os backups anteriores.
- Nenhum PIN, senha, nota pessoal, chave mestra ou URL privada do Craft deve ser incluído em commits, logs, issues ou artifacts.
- Ainda faltam testes reais em iPhone e estratégia de migração de dados antes de trocar o endereço principal. O domínio próprio só será apontado depois.

## Validação antes de ativar

```bash
cd site-v51
npm run qa
node tests/deploy-config.mjs
```

O upload do Worker somente acontece no job de deploy condicionado à variável. O smoke test posterior verifica `/api/health` e `/api/profiles` **sem modificar dados**.

Documentação técnica: [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/) e [wrangler-action](https://github.com/cloudflare/wrangler-action).
