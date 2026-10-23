# MED JITA · Contrato de versão

O código está versionado no repositório de origem do Sites. Não é necessário criar um GitHub adicional.
O Craft continua como fonte de perfis, senhas opcionais, configurações e histórico espelhado.

## Antes de publicar

1. Preservar os quatro perfis configurados e quaisquer perfis ativados posteriormente no Craft.
2. Rodar `npm run qa` e interromper o deploy se algum teste falhar.
3. Em cada nova publicação que altere scripts, HTML ou estilos, atualizar **juntos** a versão do cache em `source/sw.js` e `?v=` dos scripts em `source/index.html`.
4. Conferir no navegador a jornada *abrir URL → escolher nome → entrar na calculadora → alterar nota → ver confirmação de salvamento*.
5. Validar opcionalmente o desbloqueio por senha do histórico e a troca de pessoa.
6. Conferir se o Craft acusa sincronização, sem sobrescrever históricos de usuários com valores de teste.
7. Registrar o commit e a versão do Sites antes da publicação; se o resultado publicado regredir, restaurar uma versão anterior identificada.

## Comportamento aprovado

- Abrir a URL sem autenticação do ChatGPT.
- Mostrar JBFS, Barba, Tay e Igu, além de eventuais usuários completos autorizados no Craft.
- Entrar tocando no perfil; senha de histórico somente se habilitada pelo próprio usuário ou JBFS.
- Salvar automaticamente online, sem botões de backup nem configuração manual obrigatória.
- Espelhar no Craft quando o serviço estiver disponível; informar se houver pendência.
- JBFS administra os perfis e senhas na Collection Craft.

## Critério de conclusão

Uma publicação `succeeded` confirma entrega, **não funcionamento**. Só considerar validada quando a tela pública cumprir os fluxos acima. O Git permite auditoria e reversão; ele não substitui testes reais.
