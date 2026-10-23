# MED JITA · Saída gradual da Vercel e do Sites (V50 portátil)

**Estado desta ramificação:** código preservado no GitHub e preparativos de publicação independente. **Ainda não há um endereço novo publicado nem dados migrados.** Não modificar os dois sites antigos ou a base de dados em uso enquanto as quatro contas não passarem na validação.

## Qual é a versão confiável?

- **Fonte congelada:** MED JITA V50 do Sites, commit de origem `4283f02`, copiado com 134 arquivos originais para a ramificação `med-jita-portatil-v50` em `jairobfs/med-jita`.
- **Fonte das próximas melhorias:** esta ramificação, com correção do teclado numérico para PIN no iPhone e do CSS das transições no pacote.
- **Vercel:** legado em modo de preservação; não fazer deploy nem apagar banco.
- **Sites:** mantém acesso e sincronização atuais até que outra hospedagem prove paridade.
- **GitHub `main`:** intocado; não substituir a antiga V6 sem validar a migração.

## Arquitetura independente proposta

Um único Cloudflare Worker serve o app completo e suas rotas `/api/*` na **mesma origem**. Não precisamos dividir o site entre GitHub Pages e API externa, o que preserva os contratos existentes de perfil e de salvamento.

- GitHub: código-fonte e ações de teste/publicação sob a conta JBFS.
- Cloudflare Workers: página, mascote, PWA, simulações, API e domínio gratuito `*.workers.dev` — sem nomes Vercel/ChatGPT.
- Cloudflare D1: banco novo de snapshots e revisões; dados cifrados pelo servidor.
- Craft do espaço MED: cadastro das pessoas e espelho editorial do histórico quando a conexão for configurada. Essa dependência permanece por escolha do projeto; a chave privada fica exclusivamente no servidor.
- Login: seleção simples de perfil; PIN do histórico opcional, com teclado numérico e alternativa para senhas antigas com letras.

## Preparação única da conta

Esta etapa precisa ser feita sob contas do usuário; nenhum token de infraestrutura entra no código público.

1. Ter uma conta Cloudflare própria. O endereço inicial poderá terminar em `workers.dev` e não precisa de domínio comprado.
2. Criar uma base D1 chamada `med-jita-jbfs`. Pela CLI oficial: `npx wrangler d1 create med-jita-jbfs`. Copiar **somente** o identificador UUID indicado pela Cloudflare.
3. Nas **GitHub Secrets → Actions** de `jairobfs/med-jita`, cadastrar uma única vez:

   | Nome do segredo | Valor |
   |---|---|
   | `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
   | `CLOUDFLARE_API_TOKEN` | Token restrito para publicar este Worker e vincular o banco |
   | `MED_JITA_D1_DATABASE_ID` | UUID da base D1 nova |
   | `MED_JITA_MASTER_KEY` | Chave hex aleatória de 64 caracteres, guardada de forma permanente |
   | `CRAFT_API_BASE` | URL privada da conexão API do espaço **MED** já usada para esta coleção |

4. `CRAFT_SPACE_ID` está declarado como identificador público no modelo `wrangler.portable.example.toml`; o servidor **confere a identidade do espaço** antes de ler os perfis. Sem a conexão correta, o login pode ficar indisponível; não é problema do PIN.
5. O workflow `med-jita-portable-qa.yml` valida arquivo por arquivo, cálculo, histórico, PIN, paletas e animação a cada alteração na ramificação.
6. O workflow manual `med-jita-independent-publish.yml` fica preparado para ativação após a ramificação ser integrada à base padrão do GitHub (o GitHub só exibe disparos manuais de workflows presentes no branch padrão). Exige uma confirmação explícita; não publica em cada push.

A implantação também pode ser feita diretamente com Wrangler: copiar `wrangler.portable.example.toml` para `wrangler.toml`, substituir o UUID, gerar o Worker com `node scripts/build-assets.mjs`, cadastrar as duas variáveis privadas do servidor (`MED_JITA_MASTER_KEY`, `CRAFT_API_BASE`) e executar `npx wrangler deploy --config wrangler.toml`.

## O que precisa ser validado antes da troca de endereço

1. `GET /api/health`: `ok: true`, `store: true`, `profiles: true`, `editorial: true`.
2. `GET /api/profiles`: cartões **JBFS/Jairo, Barba, Tay e Igu**, com o administrador visível.
3. PIN: teclado numérico no iPhone, modo alfabético opcional, retorno ao cartão correto sem abrir histórico alheio.
4. Notas: cálculos de UCT, UCM, habilidades e demais unidades, com pesos e regimes de 7º período.
5. Salvar e recuperar nota de teste em dois aparelhos; desligar a rede e confirmar que o app continua apresentável.
6. Verificar alternância light/dark/OLED, contraste e centralização do Jita; ícone de tela inicial.
7. Conferir espelho no Craft após uma alteração de teste e comparar revisões.
8. Importar os **dados reais** de cada perfil somente depois da validação em teste, sem apagar registros originais.

## Migração dos históricos: regra inegociável

**Código-fonte não é backup de dados.** A base D1 do Sites, o histórico da Vercel e o armazenamento do iPhone não passam automaticamente para a nova base.

Para cada pessoa, registrar a revisão de origem, obter o backup completo através da sessão do próprio perfil (ou exportação no aparelho), guardar uma cópia de segurança fora do site e importar na base nova usando a mesma estrutura `med-jita-backup` v3. Comparar notas, histórico, avatar, datas e contagem de registros **antes** de redirecionar. Não reutilizar cópia cifrada do D1 antigo com outra chave: a regravação no novo servidor deve ser feita com conteúdo recuperado de forma legítima do app original.

Conflitos devem criar versões recuperáveis; não substituir silenciosamente dados antigos. O novo endereço só vira o principal após passar por uma semana de uso paralelo sem perda de sincronização.

## Histórico das correções desta preparação

- V50 completa copiada para ramificação própria do GitHub.
- Entrada do PIN passou a solicitar `inputmode="numeric"`, mantendo o tipo de campo protegido e o modo de teclado completo para senhas antigas.
- O pacote gerado agora inclui `navigation-motion.css`, anteriormente referenciado no HTML/PWA mas ausente da tabela de ativos.
- Adicionados testes dedicados ao PIN e a todos os ativos usados pela navegação e pelo cache offline.
- Adicionadas ações para verificação contínua e preparação de publicação manual independente.

Documentação oficial usada: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ ; https://developers.cloudflare.com/d1/get-started/ ; https://developers.cloudflare.com/workers/configuration/secrets/ .
