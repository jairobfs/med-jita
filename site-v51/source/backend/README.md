# Ponte experimental MED JITA

GitHub Pages publica somente o app estático; este Worker é o servidor opcional.

- `GET /api/health`: diagnóstico público.
- `GET /api/craft/test`: consulta `GET /connection` na Full Space API do Craft
  somente pelo servidor, se `CRAFT_API_BASE` estiver configurada.
- `PUT /api/snapshot`: guarda apenas um pacote AES-256-GCM já cifrado no iPhone.
- `GET /api/snapshot`: devolve o pacote cifrado; requer a credencial derivada
  do código de recuperação. Revisões evitam sobrescrita inadvertida.

O servidor não recebe o código original nem o conteúdo decifrado. Não existe
upload automático. Sem o código, o usuário não pode recuperar o histórico.

## Publicação experimental

1. Instale Wrangler localmente e crie um banco D1.
2. Copie `wrangler.example.toml` para `wrangler.toml`, ajuste `database_id`
   e a origem exata `SITE_ORIGIN` da página GitHub.
3. Aplique `schema.sql` no D1 local e no D1 de produção.
4. Configure proteção contra abuso/rate limits antes de divulgar uma API
   anônima que consome espaço no banco.
5. Publique o Worker e informe somente seu endereço HTTPS no Histórico do app.
6. Gere/guarde o código, teste a ponte, envie um backup e recupere em outro
   navegador com o mesmo código.

Para ativar a verificação de leitura Craft, rode `wrangler secret put CRAFT_API_BASE`
e forneça o URL privado de uma conexão Full Space API com escopo mínimo.
Nunca publique esse endereço no GitHub. O código testa apenas `/connection`;
**não escreve nem sincroniza notas para o Craft**. O banco de backups é o D1.

Os testes locais exercitam o contrato com servidor Craft simulado. A API HTTP
real do espaço do usuário precisa de uma conexão secreta configurada no Worker.
