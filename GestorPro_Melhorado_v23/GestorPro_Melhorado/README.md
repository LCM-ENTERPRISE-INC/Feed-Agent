# GestorPro Desktop v6 — Versão Melhorada

## O que mudou nesta versão

### 🔴 Bugs corrigidos
- **Dados não apagam mais ao abrir**: removidas as funções de limpeza automática que podiam apagar todos os dados ao trocar de navegador ou limpar cache
- **Tabela de clientes corrigida**: coluna fantasma "Indicado por" removida, cabeçalho e dados agora batem exatamente
- **Validação de datas na venda**: aviso visual e bloqueio ao tentar salvar com data de encerramento anterior ao início
- **Filtro de faturamento**: agora considera `inicio` OU `venc` para compatibilidade com registros antigos
- **`refreshAll()` otimizado**: só re-renderiza a página ativa, não todas as 12 de uma vez

### 🎨 Melhorias visuais
- Nova fonte **Sora** (display) + **JetBrains Mono** (números) — mais legível e moderna
- Cards com barra colorida no topo por categoria (verde, azul, laranja, vermelho)
- **Hover nas linhas das tabelas** com cor sutil de destaque
- **Zebra striping** nas tabelas longas para facilitar leitura
- Modais com **animação de entrada** suave (fadeIn + slideUp)
- Botões com transições e estados hover refinados
- **Toast colorido por tipo**: verde (sucesso), vermelho (erro), escuro (info)
- Sidebar reorganizada com **seções separadas** (Principal / Operacional / Financeiro / Relatórios)
- Ícones únicos e contextuais para cada item do menu
- Rodapé do sidebar limpo (sem texto técnico interno)
- Topbar com data à esquerda, ações à direita

### ⚠️ Novo aviso de backup
Banner amarelo no dashboard lembrando de exportar o backup regularmente

## Como rodar

### Windows
1. Instale o Node.js
2. Extraia o ZIP
3. Abra a pasta e execute `rodar-windows.bat`

### Mac/Linux
1. Instale o Node.js
2. Extraia o ZIP
3. Execute `rodar-mac-linux.command`

## Backup
Use os botões **Exportar backup** e **Importar backup** no topo. Faça isso regularmente — os dados ficam apenas no navegador.
