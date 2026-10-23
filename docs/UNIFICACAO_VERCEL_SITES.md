# MED JITA — reconciliação Vercel × Sites

Estado verificado em 23/10/2026. Documento de trabalho; **não é uma publicação de produção**.

## Objetivo
Um único MED JITA com endereço independente do ChatGPT **e da Vercel**, interface mobile-first, identidade Jita preservada, quatro perfis e históricos íntegros. A escolha do perfil é prioritariamente organizacional; PIN opcional é uma conveniência de identificação, não um sistema de segurança bancária. Se houver dados sensíveis, o serviço deve continuar protegendo gravações administrativas no servidor.

## Direção do projeto — corrigida pelo proprietário
A **Vercel é uma infraestrutura legada em processo de desmame**, não a plataforma definitiva. Manter a aplicação atual funcional durante a transição e tratá-la como fonte temporária de dados para migração, sem projetos novos nela. O destino deverá ser controlado pelo proprietário (repositório, implantação, dados e endereço). Escolha de provedor e domínio ainda **não homologada**; não inferir que Sites com subdomínio ChatGPT seja o destino.

## Fontes de verdade (não confundir)
- **Endereço legado ainda em uso**: https://med-jita.vercel.app — deployment confirmado: `dpl_gVoKMdXeyhf98y4B7bdRBrEECjRV` (40 arquivos no manifesto; Vercel).
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
3. **Migrar para fora da Vercel.** Escolher infraestrutura independente com código e dados sob controle do JBFS, URL sem a marca ChatGPT, domínio próprio opcional. Vercel é apenas referência e contingência temporária.
4. Consolidar seletor de perfil simplificado, identidade, cálculos gerais/UCs e fluxos mobile da Sites em **uma única base exportável**. Não depender definitivamente dos serviços da Vercel; não substituir armazenamento remoto por GitHub Pages estático sem banco/sincronização equivalente.
5. Corrigir a nomenclatura e exibição **JBFS / Jairo** no seletor, sem duplicar contas ou trocar IDs. Não assumir que o perfil ausente é um problema apenas de CSS.
6. Testar 4 perfis e fluxo de erro, autosave, reabertura, mudança de aparelho e preservação dos históricos. O PIN da interface não deve conceder administração sem verificação de servidor.
7. Testar claro/escuro/OLED, paletas, centralização do mascote, contraste de texto/campo, tamanhos de toque e viewport 320–430 px.
8. Criar prévia no **novo destino**, testar com dados de ensaio e executar migração verificável dos históricos. Manter a versão antiga acessível para rollback até a confirmação dos quatro perfis. A Vercel não deve ser desligada antes da conferência dos registros.
9. Adotar GitHub com **código real e completo do aplicativo unificado** como fonte principal do novo deploy. A branch `main` V6 não é essa fonte atualmente. O JavaScript da Vercel arquivado nesta branch é apenas uma referência de compatibilidade.

## Critérios de aposentadoria da Vercel
- Quatro perfis identificados e migrados sem troca de IDs ou notas.
- Cálculos e histórico funcionando no novo endereço, com persistência entre dispositivos.
- Backup legível e exportável verificado antes e depois.
- Craft editorial e administrativo mantido conforme integração efetivamente testada.
- URL principal nova, testada em iPhone, inclusive adicionar à tela inicial, light/dark/OLED.
- Retirada da Vercel **só depois** dessas validações; nenhuma exclusão ou desligamento automático.

## Princípios
- Identidade: preservar logo/mascote reconhecível; sem emojis.
- Login: estética de perfil antes de burocracia; PIN opcional, controles de edição e privacidade conforme dados efetivamente armazenados.
- Autonomia: fonte versionada, notas de implantação, exportação e restauração testadas.
- Resguardo: sem modificar os registros existentes ou desativar o aplicativo oficial em nome de uma melhoria visual.
