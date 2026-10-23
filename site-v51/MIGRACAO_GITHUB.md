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
