# MED JITA · aplicativo vivo

Calculadora de notas mobile-first, com motor curricular para todas as UCs de Medicina (matrizes 2023, 2024 e 2025), preservando o legado V6 e a identidade Jita V11.1.

## Arquitetura

- `source/index.html` — aplicativo e cálculos existentes, sem notas preenchidas previamente.
- `source/integrations/uc-engine.js` — modelos fundamentados nos arts. 9, 20, 31 e 45 da Resolução CONSU nº 032/2026: UCT/UCM, HP/AP, IESC/AESC, UCF, UGC/UCE, UDE/ERA, internato e modelo personalizável.
- `source/icons/`, `source/assets/` — figuras e marcas de origem.
- `source/integrations/sync-ui.js` — backup cifrado no navegador e recuperação sem login.
- `source/integrations/editorial-live.js` — textos públicos revisados do Craft ao abrir/retomar o aplicativo.
- `worker/runtime.js` — API do histórico cifrado em D1 e leitura seletiva do Craft pelo servidor.
- `scripts/build-assets.mjs` — preserva os arquivos e incorpora-os ao Worker ESM.
- `.openai/hosting.json` — infraestrutura D1 do Site.

Não inserir a URL privada do Craft no código. `CRAFT_API_BASE` deve ser uma variável secreta do Site; o serviço também exige `CRAFT_SPACE_ID=6606bf28-79b6-7415-c5c5-6d0a79f7f279`. Sem as duas configurações, a API editorial permanece desativada. Mesmo depois de configurado, o servidor valida o ID real com `GET /connection` antes de ler a Collection e bloqueia conexões de outros espaços. O link deve ser criado no próprio espaço ⌯ MED, jamais reaproveitado de outro espaço.

## Construção e testes

```bash
npm run build
npm run validate
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

## Backup privado

O código criado no aparelho tem 256 bits. O navegador cifra o backup com AES-GCM; o servidor só armazena bytes cifrados e um identificador derivado do código, sem receber o conteúdo em claro. O mesmo código permite recuperar as notas em outro aparelho. Escritas concorrentes retornam HTTP 409.

Sem envio explícito, notas e histórico permanecem no armazenamento local. Não existe sincronização automática silenciosa de notas.

## Homologação

- O site deve servir o app, os SVGs, o manifest e o service worker.
- `/api/health` deve indicar `store: true`; `editorial: true` somente depois da conexão própria de MED.
- `/api/editorial` deve trazer somente itens `Revisado`.
- Um backup com código **de teste** deve ser recuperado em outro navegador.
- Uma alteração do Craft deve aparecer no aplicativo sem upload de código.
- Manter o GitHub Pages atual intacto até a regressão passar.
