# MED JITA · Calculadora de Notas

Calculadora acadêmica estática, sem dependências externas, pronta para GitHub Pages e para ser adicionada à Tela de Início do iPhone.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub ou escolha um de sua propriedade.
2. Envie **todos os arquivos e as pastas `icons/` e `assets/`** deste pacote para a raiz do repositório. O arquivo de entrada deve se chamar `index.html`.
3. Nas configurações do repositório, acesse **Settings → Pages → Build and deployment**.
4. Em **Source**, escolha **Deploy from a branch**; selecione `main` e a pasta `/ (root)`; salve.
5. Aguarde a publicação e abra a URL indicada pelo GitHub Pages, normalmente `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

Para a **calculadora offline**, não é necessário Node, npm nem servidor próprio. Os caminhos são relativos, permitindo instalação em URLs com subpasta de repositório. A sincronização entre dispositivos é opcional e requer o Worker separado em `backend/`.

## Adicionar ao iPhone

1. Abra a **URL publicada** no Safari do iPhone.
2. Use o botão de instalação dentro do MED para visualizar as etapas.
3. Toque em **Compartilhar → Adicionar à Tela de Início**.
4. Habilite **Abrir como App da Web** e confirme em **Adicionar**.

O iOS não oferece a sites um comando para instalar diretamente sem essa confirmação manual. Nos navegadores com suporte a `beforeinstallprompt`, o mesmo botão pode chamar o diálogo do navegador.

## Uso offline e atualizações

- Depois do primeiro acesso online à versão publicada, o service worker mantém os recursos principais em cache para uso offline.
- Notas, pesos e preferências são guardados localmente pelo navegador. A seção **Histórico** oferece registros nomeados, restauração e backup completo em JSON, sem cadastro.
- Um backup completo inclui o preenchimento atual e até 60 registros nomeados. Salve-o antes de limpar os dados do Safari, mudar o endereço do repositório ou trocar de aparelho. O Safari e o app instalado podem ter armazenamentos distintos.
- Ao atualizar arquivos do aplicativo, modifique o identificador `CACHE_NAME` em `sw.js`. Isso força a atualização dos recursos offline na próxima conexão.
- O arquivo `JITA_vetorial.svg` é uma vetorização real do mascote fornecido pelo autor. Os PNGs servem como ícones compatíveis com iOS e manifest.

## Identidade visual

- A marca oficial do produto é **MED JITA**, com lettering cursivo vetorizado e símbolos matemáticos. O arquivo original, sem dependência de fonte, está em `assets/med-jita-logo.svg`.
- A capa e os seis ícones temáticos usam exatamente o **contorno vetorial original do JITA**, incluindo olhos, cílios, boca, língua, laço e cartola. Nenhuma expressão facial foi redesenhada. Os símbolos de RC, Morfo, Anatomia, Tutoria e simulações aparecem em badges externos ao personagem, nos arquivos `icons/jita-*.svg`.
- Em **Critérios e dados → Universo de cores**, escolha Aurora, Mineral, Figo ou ATLAS · Integrado. As quatro paletas funcionam nos modos claro, escuro e automático. A preferência é preservada no dispositivo e no backup JSON.
- Os elementos geométricos discretos e a paleta ATLAS · Integrado foram reaproveitados do **Kit_Estigmas_Integrado_v3.zip**, criado para o projeto ATLAS × AvaliA em outubro de 2026, com base em referências cromáticas fornecidas pelo autor. Os arquivos `assets/estigma-atlas-*.svg` preservam os vetores do kit original.
- **Identidade institucional:** o arquivo `assets/integrado-oficial-2026.png` foi obtido diretamente do cabeçalho público do site atual do Centro Universitário Integrado, em 22/10/2026. Ele é usado sem redesenhar suas formas. A calculadora MED JITA é independente; a marca aparece exclusivamente como contexto acadêmico, sem sugerir endosso institucional. Os estigmas do ATLAS são ornamentos editoriais distintos do logo.
- **Ícones JITA V4:** cada função possui composição e cor próprias (gráfico, ficha clínica/caneta, DNA, osso, livro, laboratório ou relógio). Em todos, a silhueta e o rosto são reutilizados do mesmo caminho vetorial original, sem reinterpretar a expressão.

## Pesos e cautelas

No modo **CAB integrado**, o protótipo assume 4,0 pontos para a prova que reúne Raciocínio Clínico e Morfofuncional (Macro e Micro). Quando há **Macro prática separada**, assume 2,6 pontos de teoria e 1,4 ponto de Anatomia. Tutoria e Formativa têm pesos-padrão de 5,0 e 1,0 respectivamente. Confira os regulamentos institucionais, especialmente a redistribuição no CAB integrado e os critérios de arredondamento.

Os campos de notas e acertos começam vazios; exemplos aparecem somente como texto-guia nos placeholders. Os pesos-base e a nota de corte são editáveis. As simulações de anulação e AVA são matemáticas e não vinculantes.

## Craft e histórico online experimental

O Histórico agora contém um **cliente funcional** de backup cifrado, sem login, com geração de código e ações explícitas para testar, enviar e recuperar. Ele funciona após você publicar e configurar `backend/` como Worker com banco D1. Para testar uma conexão real com o Craft, configure o segredo `CRAFT_API_BASE` apenas no Worker: o endpoint `/api/craft/test` faz leitura `GET /connection`, sem publicar credenciais e sem modificar documentos.

Consulte [`backend/README.md`](backend/README.md) e [`integrations/CRAFT_COMPATIBILIDADE.md`](integrations/CRAFT_COMPATIBILIDADE.md). A sincronia do Craft como repositório documental de notas **ainda não está implementada**. O armazenamento remoto do protótipo é o D1, não o Craft. Nenhum login ou envio automático está ativo.
