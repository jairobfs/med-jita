# MED JITA V52 · Identidade curricular e som opcional

Este incremento preserva os vetores oficiais do mascote original V11, as notas, os perfis e os pesos do motor curricular existente.

- Selos SVG distintos para todos os módulos e todos os componentes de nota catalogados no motor curricular.
- Componentes criados pelo usuário recebem monograma vetorial no lugar de um ícone quebrado.
- Os selos são integrados aos cartões de UC, cabeçalhos de componentes e título do módulo ativo; não interferem nos cálculos.
- O Jita ganha partículas periféricas após o toque, sem alterar rosto, corpo, cartola ou cauda.
- Sons sintéticos apenas após ativação explícita; desligados por padrão. A fala em português depende das vozes instaladas no navegador e só ocorre no botão Ouvir o Jita.
- Inclui redução de movimento, teclado, contraste, dark/light/OLED e foco no iPhone 320–430 px.

## Migração segura

O frontend V51/V52 permanece em site-v51/source. Ele não substitui a página pública V19/V6 nem migra dados remotos automaticamente. A publicação definitiva requer conciliar os quatro perfis, históricos e sincronização Craft com o motor V51. Não pressupor que backup remoto opcional implique integração Craft.

Testes: node tests/v52-identity.spec.mjs. Pacote de ativos: node site-v51/scripts/build-assets.mjs.