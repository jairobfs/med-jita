# MED JITA · Identidade V08 híbrida

## Decisão editorial

A atualização incorpora a assinatura orgânica e uma seleção dos ícones vetoriais do Laboratório V08, sem substituir a direção de arte validada no aplicativo principal.

### Preservado

- Mascote Jita original no hero, nos cinco ícones ilustrados da navegação e no seletor de perfis.
- Paletas Aurora, Mineral, Figo e Integrado, com temas claro, escuro e automático.
- Arquitetura das telas, capa em gradiente, cartões, microinterações e marca institucional em área independente.
- Ícone PWA original, para evitar uma alteração silenciosa da marca instalada no iPhone.
- Chaves de armazenamento, esquemas de dados, autenticação dos perfis, sincronização, cálculos e histórico.

### Incorporado da V08

- Assinatura **orgânica** completa, nas versões positiva (capa) e inversa (barra lateral).
- Selo `J + cartola` como sinal compacto no cabeçalho; ainda não promove o candidato a ícone PWA definitivo.
- Gestos funcionais vetoriais de ajustes, exportação e salvamento, com variantes para fundos escuros.
- Wordmark da V08 como assinatura auxiliar na seleção de perfil.

### Regra de não regressão

As alterações devem permanecer isoladas em CSS e `integrations/brand-v08.js`; nenhuma nova identidade deve sobrescrever lógica de avaliação ou dados de usuários. O logo anterior permanece no HTML como fallback; os arquivos V08 são servidos localmente e incluídos no cache offline.

### Prova de produção V22 · grid óptico

- A origem das imagens em produção é `source/assets/`, com teste real a 16, 24, 32 e 64 px na bancada adicional do Ateliê V11.1.
- Exportar: a forma de 64 unidades foi alargada em 10% e comprimida verticalmente em 10% ao redor do centro do grid, aproximando sua caixa visual da de Ajustes sem mudar os elementos reconhecíveis.
- Salvar: deslocamento vertical óptico de 1,25 unidade para equilibrar o espaço superior/inferior.
- Barra superior: imagens funcionais ampliadas de 21 para 23 px de caixa CSS, preservando as áreas de toque originais.
- No Ateliê, o banco de produção usa os SVGs diretamente, incluindo os cinco ícones de navegação V11 já integrados à versão publicada; a coleção experimental de 16 gestos e seu teste cego continuam independentes.

### Próxima aprovação de arte

Validar a leitura da assinatura e dos selos nos tamanhos 16, 24, 32 e 64 px, especialmente no iPhone em claro/escuro/OLED, antes de trocar o ícone PWA original.
