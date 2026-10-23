# MED JITA — reconciliação Vercel × Sites

Estado verificado em 23/10/2026. Documento de trabalho; **não é uma publicação de produção**.

## Objetivo
Um único MED JITA com endereço independente do ChatGPT, interface mobile-first, identidade Jita preservada, quatro perfis e históricos íntegros. A escolha do perfil é prioritariamente organizacional; PIN opcional é uma conveniência de identificação, não um sistema de segurança bancária. Se houver dados sensíveis, o serviço deve continuar protegendo gravações administrativas no servidor.

## Fontes de verdade (não confundir)
- **Endereço oficial atualmente em uso**: https://med-jita.vercel.app — deployment confirmado: `dpl_gVoKMdXeyhf98y4B7bdRBrEECjRV` (40 arquivos no manifesto; Vercel).
- **Outra experiência publicada**: https://med-jita.jairobfs7.chatgpt.site — Sites v47; fluxo de seleção de perfis/PIN, calculadora ampliada e temas.
- **Deployment mais recente da Vercel não equivale ao endereço oficial**: `dpl_HMiaQbthU9ERKw2CQB6MQNJ2Utpw` contém arquivos e alterações de API que não foram comprovados no alias oficial.
- **GitHub `jairobfs/med-jita` e `jairobfs/med-jita2`** guardam versões V6 de GitHub Pages, não o backend oficial de login e sincronização. Não conectar automaticamente a Vercel à branch `main` antiga.
- **Esta branch** `unificacao-med-jita-2026` é uma área isolada de revisão, não publicada.

## Alteração de código preparada

Arquivo `integracao-vercel/integrations/sync-ui.js`:
- derivado do JS de login/sincronização do endereço oficial da Vercel;
- preserva rotas, payloads, sessão e operações de salvamento;
- altera **somente duas seções CSS**: dimensões e legibilidade do seletor de perfis, respiros mobile, contraste do dark mode;
- aplica dark mode segundo `document.documentElement.dataset.theme`, que é o estado real definido pela calculadora (inclusive escolha automática).

Comparar com `https://med-jita.vercel.app/integrations/sync-ui.js` antes de integrar. Executado `node --check` com resultado positivo. **Não contém correções de autenticação nem do backend.**

## Validação já obtida
- Preview da Vercel `dpl_5bKqqC8NQuw87aqVKVm9nGd55kZq` ficou READY; `/`, `/api/health`, `/api/identity` responderam HTTP 200.
- Os quatro identificadores de perfil foram preservados na API da prévia.
- Este preview foi gerado sobre um manifesto diferente do *alias de produção*; portanto **não promover diretamente para produção** sem revisar os arquivos de API divergentes.
- O alias de produção permaneceu intacto.

## Bloqueio verificado
A Vercel respondeu HTTP 402 (`payment_required`, limite `api-deployments-free-per-day`, mais de 100 publicações) ao tentar criar uma segunda prévia com o manifesto **exatamente** correspondente à produção. Não contornar o limite. Retomar após o reset do plano ou autorização expressa do proprietário para alterar o plano.

## Próximo ciclo de integração
1. Extrair versão integral e verificável do **deployment oficial** e do último deployment não-aliased, comparando cada rota de API e configuração antes de qualquer publicação.
2. Fazer backup exportável dos perfis/históricos de produção. Evitar incluir PIN, código de acesso ou dado privado em repositório público.
3. Preservar a Vercel como endereço final independente; considerar domínio próprio se desejado (não é obrigatório).
4. Portar seletor de perfil simplificado e consistência da marca, cálculos gerais/UCs e fluxos mobile da Sites, usando os serviços da Vercel que já salvam online. Não substituir o armazenamento pela versão de GitHub Pages.
5. Corrigir a nomenclatura e exibição **JBFS / Jairo** no seletor, sem duplicar contas ou trocar IDs. Não assumir que o perfil ausente é um problema apenas de CSS.
6. Testar 4 perfis e fluxo de erro, autosave, reabertura, mudança de aparelho e preservação dos históricos. O PIN da interface não deve conceder administração sem verificação de servidor.
7. Testar claro/escuro/OLED, paletas, centralização do mascote, contraste de texto/campo, tamanhos de toque e viewport 320–430 px.
8. Criar **prévia sobre a mesma base que está aliased**, testar e só então substituir o alias oficial, preservando rollback e dados.
9. Depois da fusão, conectar um repositório que contenha o **código real da Vercel** à implantação. A branch `main` V6 não é essa fonte atualmente.

## Princípios
- Identidade: preservar logo/mascote reconhecível; sem emojis.
- Login: estética de perfil antes de burocracia; PIN opcional, controles de edição e privacidade conforme dados efetivamente armazenados.
- Autonomia: fonte versionada, notas de implantação, exportação e restauração testadas.
- Resguardo: sem modificar os registros existentes ou desativar o aplicativo oficial em nome de uma melhoria visual.
