# MED JITA · Funcionamento da integração Craft

Atualizado em 23/10/2026.

## Uso diário

- O site MED JITA é publicado no Sites, com quatro perfis iniciais: JBFS, Barba, Tay e Igu.
- O mantenedor administra os perfis na Collection **MED JITA · Usuários** do Craft: nome, e-mail opcional para contato, acesso, código e senha opcional do histórico.
- A entrada usa a escolha explícita do perfil, sem exigir e-mail nem digitação de código. Mesmo no aparelho já utilizado, o aplicativo não abre automaticamente o histórico da última pessoa. O comando **Trocar pessoa** continua disponível.
- O preenchimento e até 60 versões nomeadas são salvos automaticamente no banco online do aplicativo. O mesmo perfil recupera seus próprios dados ao entrar em outro aparelho.
- Após cada gravação online, o servidor tenta atualizar, na ficha Craft da pessoa, um resumo de revisão e um bloco de código JSON com o backup integral (dados atuais e histórico). O campo **UltimaSincronizacao** recebe a data da última confirmação dessa atualização.
- O campo **Sincronizacao** de cada perfil permite ao mantenedor ligar ou desligar especificamente o espelho no Craft sem desativar o salvamento online.
- A API responde com `craftMirrored` para distinguir gravação online concluída de espelhamento Craft confirmado. Uma falha temporária no espelho não apaga o backup salvo online.

## Fluxo de dados

1. O usuário escolhe seu nome na tela inicial; o código cadastral no Craft funciona como marcador administrativo de ativação, não como uma etapa adicional da entrada.
2. O site consulta a Collection Craft para verificar se o perfil está habilitado.
3. O site carrega somente o histórico do perfil selecionado; definir uma senha adicional no Craft é opcional, mas, quando definida, a senha é exigida para abrir aquele histórico.
4. Ao editar a calculadora, um salvamento automático registra a nova revisão no servidor.
5. O servidor atualiza o resumo e o JSON da ficha existente no Craft, com verificação de leitura.
6. Se duas sessões alterarem a mesma revisão, a API recusa sobrescrita silenciosa e preserva o estado existente.

## Localização e formato do espelho

- Collection: **MED JITA · Usuários** (`c4a350de-9e9d-4e29-6f0c-ec31cc6b4ba7`).
- Em cada item, o bloco textual marcado **MED JITA · Estado sincronizado** mostra perfil, revisão, data e quantidade de históricos.
- O bloco de código JSON guarda `{ medJitaMirror: 1, id, revision, updatedAt, backup }`. `backup` segue o formato `med-jita-backup`, versão 3.
- O servidor atualiza os mesmos blocos nas gravações posteriores. Novos perfis criados na Collection recebem os blocos na primeira gravação, desde que tenham as propriedades requeridas.

## Limitações reais

- O espelho é do aplicativo para o Craft; editar manualmente o JSON do histórico no Craft não reimporta os dados para o site. A edição de cadastros, códigos, senhas e textos editoriais no Craft continua sendo aplicada ao site.
- Uma conexão Craft com leitura mas sem permissão de escrita permite o login e o salvamento online, porém impede a atualização do espelho. Nesse caso `craftMirrored` é `false`.
- Os registros existentes no banco online não são apagados nem substituídos por uma falha de gravação no Craft.
- A publicação do Sites mantém seu controle de público próprio, independente da escolha de perfil. O histórico de cada pessoa só é carregado após sua seleção explícita e, caso configurada, a senha pessoal.

## Referência

- API de blocos: https://connect.craft.do/api-docs/documents/
- Integração Craft: https://support.craft.do/en/integrate/api
