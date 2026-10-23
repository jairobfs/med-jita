# MED JITA · transição para GitHub canônico

Fonte oficial de código: **[jairobfs/med-jita](https://github.com/jairobfs/med-jita)**.

## O que esta migração preserva

- A versão **V51** do aplicativo vivo fica em `site-v51/`, com código-fonte, identidade do Jita, mecanismos de notas, perfis, sincronização e testes.
- O sistema anterior na raiz do repositório (GitHub Pages/V6) **não é removido nem substituído**. Seu workflow de publicação continua independente.
- A versão em `med-jita.jairobfs7.chatgpt.site` **não é atualizada por este pull request**; ela tem runtime próprio com D1.
- `jairobfs/med-jita2` e a versão na Vercel não são modificados.

## Reproduzir e verificar

```bash
cd site-v51
npm run qa
```

O comando recompila o Worker ESM e executa todos os testes de cálculos, currículos, quatro perfis, conflitos de histórico, contrastes e movimento do Jita. A compilação cria `worker/index.js` e `dist/`. O arquivo de saída gerado não foi copiado como código-fonte.

## Cuidados com dados e credenciais

- Nenhuma nota de usuário, histórico pessoal, PIN, senha ou conteúdo do banco de produção é importado ao GitHub.
- `.openai/hosting.json` foi intencionalmente excluído: descreve o ambiente específico do Site, não o projeto portável.
- `CRAFT_API_BASE` deve continuar como segredo da plataforma, nunca no repositório.
- A migração futura de hospedagem exige provisionar o serviço/banco e comparar o comportamento com dados *de teste*; nenhum endereço deve mudar antes de testes end-to-end e estratégia de recuperação.

## Ordem segura para concluir a transição

1. Revisar e integrar o código da V51 no GitHub.
2. Definir deploy automático a partir de commit/release do GitHub, com os segredos da plataforma de destino.
3. Validar login, identidade por perfil, cálculos por UC, histórico, exportação, animações e instalação no iPhone.
4. Só depois, apontar o domínio próprio; preservar o endereço anterior como fallback temporário.

Este diretório é um estágio de migração, não um segundo app concorrente.

## V54 · Topologia e verificação adicional

- O GitHub Pages em `https://jairobfs.github.io/med-jita/` mantém o gateway V19 com a calculadora anterior. A galeria independente de marcas está em `/identidade/`. Essas páginas estáticas **não** hospedam as APIs dos quatro perfis V51.
- A V51 usa `credentials: 'same-origin'` nas rotas `/api/profile/*`. O Worker Cloudflare bloqueia `Origin` externo. Assim, o app e a API devem residir **na mesma origem** quando a hospedagem independente estiver preparada; abrir CORS ou embutir PINs nas URLs não é alternativa segura no iPhone.
- O fluxo `.github/workflows/deploy-v51-worker.yml` aceita implantação de teste disparada pelo GitHub, mas permanece condicionado a `MED_JITA_CANARY_ENABLED` e às credenciais configuradas de forma reservada no próprio GitHub. Não incluir os respectivos valores neste documento.
- O teste `site-v51/tests/offline-brand-cache.mjs` protege a instalação PWA: confere as referências do HTML e simula acesso sem rede a CSS e JavaScript com `?v=`, após serem adicionados ao cache sem query. `npm run qa` o executa junto da suíte existente.

### Conferência sem perda de dados antes do corte

1. Confirmar o estado do canário (`/api/health`) e testar quatro perfis: JBFS, Barba, Tay e Igu, com contas e dados de teste quando possível.
2. Verificar escolha explícita do perfil, desbloqueio opcional, id/revisão do histórico, gravação/releitura, sincronização Craft, conflitos de revisão e independência entre contas.
3. Antes de qualquer migração de dados reais, fazer backups verificáveis de cada perfil e conferir quantidades, IDs, valores e revisões no ambiente antigo e no destino. Jamais sobrescrever revisão nova com snapshot antigo.
4. No iPhone, validar teclado numérico de PIN quando exibido, entrada/salida por perfil, tema claro/escuro/OLED, notas das diversas UCs, reprodução optativa de áudio e comportamento offline. Offline não significa que a sincronização remota ocorreu.
5. Apontar o domínio independente apenas após a conferência e manter rollback simples. Não excluir a Vercel, o Site anterior, o D1 antigo ou os dados Craft durante a transição.

**Limite desta alteração:** não há migração de históricos, DNS ou segredo; trata-se do cache e dos testes de um app cuja fonte principal já é o GitHub.
