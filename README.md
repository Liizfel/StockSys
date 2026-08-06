# 📦 StockSys - Sistema Inteligente de Gestão de Estoque e Contagem

> Uma solução corporativa completa, fluida e altamente responsiva para controle de inventário, auditoria de estoque em tempo real, registro de ponto de acesso de colaboradores e análise preditiva de compras.

---

## 🌟 Funcionalidades Principais

O **StockSys** foi projetado para oferecer máxima eficiência e usabilidade tanto para a equipe de operação (Atendentes) quanto para a liderança (Gestores), dividindo-se de forma inteligente conforme o nível de acesso (RBAC):

### 👤 Visão de Atendentes (Operacional)
- **Leitor de Código de Barras Real-Time**: Use a câmera do dispositivo para escanear produtos instantaneamente e registrar contagens sem digitação.
- **Painel de Contagem Intuitiva**: Filtros rápidos para localizar itens pendentes ou em processo, com registro ágil de quantidade física e notas de observação.
- **Upload de Fotos do Produto**: Permite anexar fotos reais do produto em estoque (via arquivo ou tirando foto diretamente da câmera) para auditoria visual.
- **Registro de Ponto Digital**: Controle simples e seguro de entrada (Login) e saída (Logout) de turno diretamente pela interface.

### 👑 Visão de Gestores (Administração)
- **Dashboard Executivo Analítico**: Monitoramento instantâneo de solicitações de compra pendentes, pedidos em andamento, itens aguardando conferência de gestor e produtos com estoque crítico.
- **Modo Kanban Avançado**: Controle total do fluxo de materiais arrastando e soltando cartões (drag & drop) entre os status do inventário com total fluidez.
- **Sugestões de Compra Inteligentes**: Algoritmo preditivo avançado que calcula o ponto de ressuprimento ideal e sugere a quantidade exata para compra com base no giro diário do produto, prazo de entrega do fornecedor e estoque mínimo de segurança.
- **Histórico e Auditoria Geral de Estoque**: Painel detalhado de todas as movimentações realizadas, gráficos de timeline de atividades por dia e exportação de dados em formatos profissionais.
- **Central de Relatórios Multiformato**:
  - **Exportação para PDF Corporativo**: Relatórios diagramados profissionalmente com cabeçalhos elegantes, estatísticas resumidas e tabelas auto-pagináveis (usando jsPDF).
  - **Relatório Pronto para WhatsApp**: Formatação otimizada com markdown profissional para envio direto aos fornecedores ou gerência pelo WhatsApp.
- **Gestão de Equipe & Setores**: Criação e edição completa de colaboradores, cargos, setores e fornecedores vinculados de forma dinâmica.

---

## 🛠️ Tecnologias Utilizadas

O sistema foi desenvolvido sob uma arquitetura moderna e escalável, focando em altíssima performance, responsividade impecável e design sofisticado:

- **Frontend**:
  - [React](https://react.dev/) (Hooks, Contexts, Lazy Loading)
  - [Vite](https://vitejs.dev/) (Ambiente de desenvolvimento rápido e empacotamento otimizado)
  - [Tailwind CSS](https://tailwindcss.com/) (Estilização utilitária de ponta, 100% responsiva para telas mobile, tablets e desktops)
  - [Framer Motion](https://www.framer.com/motion/) (Micro-animações elegantes e transições fluidas de tela)
  - [Lucide React](https://lucide.dev/) (Pacote de ícones modernos e limpos)
  - [Recharts](https://recharts.org/) (Gráficos analíticos dinâmicos de alta performance)
- **Backend / API**:
  - [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)
  - [Express](https://expressjs.com/) (API REST robusta com tratamento de erros, validação de requisições e segurança)
  - [JWT (JSON Web Tokens)](https://jwt.io/) (Autenticação robusta para controle de acesso)
- **Utilitários e Serviços**:
  - [jsPDF](https://github.com/parallax/jsPDF) (Geração nativa de documentos PDF estruturados no cliente)
  - [html5-qrcode](https://github.com/mebjas/html5-qrcode) (Scanner de códigos de barras robusto e compatível com múltiplos navegadores)

---

## 📱 Responsividade de Excelência

O design do StockSys foi meticulosamente planejado para se adaptar com perfeição a qualquer tamanho de tela:
- **Dispositivos Móveis (Celulares)**: Sidebar flutuante oculta acionável por menu hambúrguer com gestos suaves, tabelas e Kanban com scroll horizontal nativo otimizado para toque, botões de toque com tamanho mínimo de `44px` e modais centralizados de fácil operação.
- **Tablets & iPads**: Aproveitamento ideal do espaço híbrido com grades adaptativas e auto-ajustáveis.
- **Desktops & Telas Larga**: Layout expandido em colunas bem distribuídas, efeitos de hover de altíssima precisão e animações sutis de fade-in para as interfaces.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
Certifique-se de possuir o [Node.js](https://nodejs.org/) instalado em seu computador (Versão 18 ou superior recomendada).

### Passos para Configuração

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/seu-usuario/stocksys.git
   cd stocksys
   ```

2. **Instalar Dependências**:
   ```bash
   npm install
   ```

3. **Executar em Modo de Desenvolvimento (Frontend + Backend juntos)**:
   ```bash
   npm run dev
   ```
   A aplicação estará disponível em `http://localhost:3000`.

4. **Compilar para Produção**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploy no Vercel

O projeto está totalmente preparado para ser implantado na **Vercel** de forma rápida, aproveitando a capacidade Full-stack com serverless functions ou servindo como SPA integrada.

### Configuração Pré-existente (`vercel.json`)
O arquivo de configuração `vercel.json` na raiz do projeto já define os roteamentos e redirecionamentos necessários para que o roteamento de rotas SPA do React (`react-router-dom`) funcione perfeitamente sem retornar erros `404` ao atualizar a página:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Passos para Fazer o Deploy:

1. **Instalar a Vercel CLI** (opcional se for usar o painel web):
   ```bash
   npm install -g vercel
   ```

2. **Fazer Login e Iniciar o Deploy**:
   ```bash
   vercel
   ```
   Siga as instruções simples no terminal.

3. **Configuração de Variáveis de Ambiente**:
   Caso utilize um banco de dados externo ou chaves específicas no futuro, configure as variáveis diretamente no painel de configurações do seu projeto na Vercel (*Settings > Environment Variables*).

4. **Configuração via GitHub (Recomendado)**:
   - Crie um repositório no seu GitHub.
   - Suba este código para lá.
   - Acesse o painel do [Vercel](https://vercel.com/) e clique em **Add New > Project**.
   - Importe o repositório do GitHub.
   - O Vercel detectará as configurações automaticamente. Clique em **Deploy** e seu site estará online em menos de 1 minuto!

---


---
*Desenvolvido com excelência, visando a melhor experiência em gestão logística e usabilidade digital.*
