# MED JITA · V50 portátil e independente

> **Preparação da migração:** esta ramificação contém uma cópia editável do app V50 e testes de publicação fora da Vercel e do Sites. O endereço antigo e seus históricos continuam intocados. Um link independente só será anunciado depois da instalação e migração de dados validadas.

[Plano de migração com segurança para os quatro perfis](docs/DESMAME_VERCEL_SITES_V50.md)

Calculadora de notas mobile-first, com motor curricular para todas as UCs de Medicina (matrizes 2023, 2024 e 2025), preservando o legado V6 e a identidade Jita V11.1.

## Arquitetura

- `source/index.html` — aplicativo e cálculos existentes, sem notas preenchidas previamente.
- `source/integrations/uc-engine.js` — modelos fundamentados nos arts. 9, 20, 31 e 45 da Resolução CONSU nº 032/2026: UCT/UCM, HP/AP, IESC/AESC, UCF, UGC/UCE, UDE/ERA, internato e modelo personalizável.
- `source/icons/`, `source/assets/` — figuras e marcas de origem.
- `source/integrations/sync-ui.js` — backup cifrado no navegador e recuperação sem login.
- `source/integrations/editorial-live.js` — textos públicos revisados do Craft ao abrir/retomar o aplicativo.
- `worker/runtime.js` — API do histórico cifrado em D1 e leitura seletiva do Craft pelo servidor.
- `scripts/build-assets.mjs` — preserva os arquivos e incorpora-os ao Worker ESM.
- `wrangler.portable.example.toml` — modelo de infraestrutura D1 + Worker fora do Sites.
- `.github/workflows/` — testes automáticos e publicação manual (ainda não ativada).

Não inserir a URL privada do Craft no código. `CRAFT_API_BASE` deve ser uma variável secreta do Site; o serviço também exige `CRAFT_SPACE_ID=6606bf28-79b6-7415-c5c5-6d0a79f7f279`. Sem as duas configurações, a API editorial permanece desativada. Mesmo depois de configurado, o servidor valida o ID real com `GET /connection` antes de ler a Collection e bloqueia conexões de outros espaços. O link deve ser criado no próprio espaço ⌯ MED, jamais reaproveitado de outro espaço.

## Construção e testes

```bash
node scripts/build-assets.mjs
node tests/pin-keyboard.mjs
node tests/portable-assets.mjs
npm test
```

## Motor de todas as UCs

Em **Minhas UCs**, a interface começa na trajetória da turma: matriz 2023, 7º período em 2026.2. O semestre acompanha a data do dispositivo; considera janeiro ainda parte do semestre anterior e fevereiro/agosto como marcos convencionais de transição. O calendário oficial pode exigir ajuste, por isso existe uma opção manual, em **Ajustes curriculares excepcionais**, recolhida por padrão. Não modificar nem apagar entradas históricas ao avançar de período.

A lista de avaliações muda conforme o regime e o plano curricular. É possível lançar nota normalizada de 0 a 10, acertos/questões válidas ou pontos diretos de conceito (TP, Formativa, Global Rating), com pesos claros e sem arredondamento intermediário. A opção **Outro módulo** cria registros distintos para a mesma UC no mesmo período, como UCT20 e UCT21. O modelo livre aceita pesos personalizados desde que totalizem 10.

Cada combinação de matriz, período, UC e registro de módulo mantém os seus lançamentos separados no perfil do usuário e no backup existente; chaves antigas continuam legíveis. A situação de frequência é independente da nota: 75% para o 1º–8º período e integralização da carga horária no internato. A aproximação de 5,75–5,99 a 6,00 é explicitada, não altera o número bruto mostrado. No REA, as notas regulares são substituídas; em UCF e UCM 4 da matriz 2024, AVE/TBL mantêm a ponderação específica 5/5.

O TP pode depender da posição do estudante na distribuição da turma, por isso o modelo solicita a **pontuação institucional convertida**, sem inferi-la apenas pelo número de acertos. Trabalhos, seminários ou fórmulas específicas devem ser conferidos no plano de ensino antes de ajustar o modelo manualmente.

## Editar pelo Craft

1. Abra a página **MED JITA · Painel editorial**, no espaço **⌯ MED**.
2. Abra a Collection **MED JITA · Textos editáveis**.
3. Altere `Conteúdo`, preservando a `Chave`.
4. Marque `Estado` como **Revisado**.
5. Depois de configurar e verificar uma conexão Full Space API do espaço MED, reabra ou atualize o MED JITA. Ao retornar ao aplicativo depois de 30 segundos, os textos são consultados novamente.

A API publica apenas textos públicos revisados. Fórmulas, pesos, mascote e dados pessoais não são editáveis nessa Collection. O histórico pessoal vai exclusivamente para o banco cifrado D1.

## Perfis, PIN e histórico online

O app organiza quatro perfis iniciais — JBFS/Jairo, Barba, Tay e Igu — selecionados na tela de entrada. A escolha do nome é cosmética/organizativa; um PIN opcional pode proteger a abertura do histórico. A entrada solicita o teclado numérico no iPhone e permite teclado completo para senhas antigas.

As notas são salvas automaticamente em uma base D1 quando o perfil está ativo. A API mantém revisões e recusa sobrescritas concorrentes; o histórico local é preservado e pode ser conciliado. O espelho do Craft é atualizado quando a conexão editorial está disponível. O conteúdo do novo banco é cifrado; a chave fica na infraestrutura do usuário, nunca no repositório público.

O recurso complementar de backup por código de recuperação permanece disponível, mas não substitui o salvamento automático dos perfis. **A migração da Vercel/Sites para uma nova D1 ainda exige copiar e verificar os históricos reais — copiar o código-fonte sozinho não os transfere.**

## Homologação

- O site deve servir o app, os SVGs, o manifest e o service worker.
- `/api/health` deve indicar `store: true`; `editorial: true` somente depois da conexão própria de MED.
- `/api/editorial` deve trazer somente itens `Revisado`.
- Um backup com código **de teste** deve ser recuperado em outro navegador.
- Uma alteração do Craft deve aparecer no aplicativo sem upload de código.
- Manter o GitHub Pages atual intacto até a regressão passar.
