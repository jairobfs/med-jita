# MED JITA · Conferência dos históricos antes da independência

**Estado: ferramenta pronta, migração real não executada.** Este procedimento não é solicitado aos quatro amigos; integra a homologação administrativa. Nunca colocar exports, PINs ou chaves no GitHub, no Craft público ou em mensagens de chat.

## O que o verificador protege

- Compara **todos os registros** da tabela `snapshots` existentes na origem, incluindo dados cifrados dos perfis, estado auxiliar de conta, revisionamento e marcador do espelho Craft.
- Confere para cada registro o identificador, a revisão, a data registrada e o SHA-256 do payload cifrado. Rejeita faltas ou divergências sem revelar o conteúdo.
- Conta separadamente quais históricos persistidos existem para JBFS, Barba, Tay e Igu; um perfil recém-criado pode legitimamente não ter snapshot.
- Apenas lê arquivos JSON locais. **Não faz upload, restauração ou escrita** em banco algum.

## Obtenção de exports (somente em ambiente autorizado)

Se a origem e o destino forem bancos D1 administrados pelo proprietário, executar localmente em ambiente com a autenticação apropriada:

```bash
mkdir -p migration-private
npx wrangler d1 execute NOME_D1_ORIGEM --remote --json \
  --command "SELECT id,revision,payload,updated_at FROM snapshots" > migration-private/origem.snapshots.json
npx wrangler d1 execute NOME_D1_DESTINO --remote --json \
  --command "SELECT id,revision,payload,updated_at FROM snapshots" > migration-private/destino.snapshots.json
node scripts/check-snapshot-migration.mjs migration-private/origem.snapshots.json migration-private/destino.snapshots.json
```

Usar configurações de projeto/conta corretas; nunca incluir autenticação nos comandos versionados. A consulta é `SELECT`, sem modificação. A saída `--json` é a estrutura devolvida pelo Wrangler; um export SQL completo também pode ser mantido em cofre privado como contingência, mas este verificador não aceita SQL diretamente.

**Se a origem for o D1 gerenciado pelo Sites ou dados locais do Safari**, este comando por si só não concede acesso à origem. É necessário obter uma exportação autorizada por outro mecanismo, sem tentar contornar a hospedagem.

## Critério de aprovação

1. Antes da importação, preservar cópia recuperável da origem.
2. Não mudar a chave `MED_JITA_MASTER_KEY` quando copiar bytes cifrados; o verificador de hashes **não testa decifração**. Se for necessário trocar a chave, a operação exigirá decifrar e recifrar de modo autorizado, seguida de comparação lógica.
3. No ambiente isolado, importar apenas após autorização e reproduzir a exportação do destino.
4. Exigir **CÓPIA FIEL** (zero faltantes, zero divergentes). Revisões e timestamps também precisam corresponder.
5. Validar com perfis de teste e depois com os quatro perfis reais em duas sessões, inclusive PIN, salvamento automático, conflitos e restauração do histórico.
6. Verificar separadamente dados que existam **somente no armazenamento local** do iPhone: não aparecem necessariamente no D1.
7. Só depois publicar e direcionar o endereço principal; manter antigas origens acessíveis até a confirmação final.

O arquivo `migration-private/` e o padrão `*.snapshots.json` estão ignorados no Git. Os testes automáticos rodam com dados **fictícios** e nunca requisitam notas reais. Se um arquivo não passar, a saída deve ser tratada como bloqueio de migração, não como convite a sobrescrever a origem.
