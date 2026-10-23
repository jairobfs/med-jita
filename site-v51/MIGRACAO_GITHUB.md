# MED JITA · Continuidade GitHub sem Vercel

Atualizado em 23/10/2026 · trilha de migração conservadora.

## Fonte e publicação

- **Fonte única:** `jairobfs/med-jita`, branch `main`. Todo ajuste novo entra por pull request com testes.
- **GitHub Pages:** `https://jairobfs.github.io/med-jita/` mantém o gateway estável; `/identidade/` apresenta as marcas, 18 módulos e estados de nota do Jita. **Não é o servidor de perfis V51**.
- **Aplicativo V51:** `site-v51/source` + `site-v51/worker` servidos sob **a mesma origem** quando o Worker Cloudflare for provisionado, com D1 para históricos e Craft para integração editorial.
- **Vercel:** legado de transição. Não o apagar, redirecionar ou desabilitar antes de confirmar a migração dos quatro perfis e seus dados.

## Por que não chamar o Worker de outro domínio a partir do GitHub Pages?

A interface usa `credentials: 'same-origin'` e rotas `/api/profile/*`. O Worker verifica `Origin` e recusa origens diferentes. Substituir por CORS permissivo, cookies terceiros ou passar PINs ao navegador em URLs enfraqueceria isolamento e falharia no iOS. O destino seguro é publicar o **HTML e a API no mesmo domínio independente**, usando o GitHub para versionar e disparar a implantação.

## Etapas antes de trocar o endereço principal

1. Criar implantação de teste do Worker pelo fluxo `.github/workflows/deploy-v51-worker.yml`; configurá-la **nas configurações do GitHub**, sem colocar tokens, códigos ou chaves no repositório. O fluxo continua desabilitado até que `MED_JITA_CANARY_ENABLED` seja ativado.
2. Confirmar, no ambiente de teste, `/api/health`, acesso legítimo aos quatro perfis (JBFS, Barba, Tay, Igu), desbloqueio opcional, gravação e releitura por perfil. Conferir que IDs e revisões não cruzam históricos.
3. Em cada perfil, comparar quantidade de registros, valores, IDs e a última revisão entre a versão atual, o armazenamento do novo ambiente e a cópia Craft. Fazer exportação de recuperação **antes** de qualquer alteração de destino. Não se deve restaurar um snapshot antigo sobre dados mais novos.
4. Verificar no iPhone: teclado numérico para PIN quando aplicável, tema light/dark/OLED, Jita centralizado, cálculo de REA/CAB/Tutoria/Habilidades/UC transversal, notas próprias, autonomia do botão instalar e retorno de app instalado.
5. Fazer teste sem rede depois da instalação: o shell, CSS curricular e JavaScript de identidade devem funcionar pelo cache; perfis remotos e sincronização mostram indisponibilidade offline sem insinuar que salvaram no servidor.
6. Somente com testes e conferência dos dados concluídos, ligar domínio próprio ao Worker e atualizar gradualmente links e atalhos. Manter rollback simples e documentado.

## Proteções não negociáveis

- Nunca incluir tokens, senhas ou códigos de acesso em HTML, git, áudio, logs ou capturas.
- Nunca substituir a origem da API por domínio paralelo só para fazer a interface carregar.
- Nunca excluir os ambientes antigos ou seus bancos durante o corte.
- Conservar a arte original V11 e os efeitos/sons como melhorias optativas, respeitando movimento reduzido e áudio desativado por padrão.
- O teste `tests/offline-brand-cache.mjs` entra em `npm test`: valida a lista de arquivos do Service Worker e simula requisições versionadas feitas pelo iPhone sem rede.

**Estado atual:** GitHub é a fonte principal, a galeria pública funciona; a transferência dos históricos para um domínio independente ainda depende da infraestrutura e da validação dos dados. Nenhuma migração de dados ocorreu nesta alteração.
