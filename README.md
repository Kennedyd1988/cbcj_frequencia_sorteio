# CBCJ 2026 · Frequência

App de controle de **matrículas, frequência e sorteio** do Curso Bíblico Conhecendo Jesus — Igreja de Cristo em Riacho da Cruz.

## Abas
- **Matriculados** — cadastro com nome completo, endereço e telefone (atalho para WhatsApp). Botão "Vários" para colar uma lista de nomes.
- **Chamada** — crie a aula (nº da lição, título e data) e toque no nome de quem está presente.
- **Frequência** — grade P/F por lição, % de cada aluno, média da turma e quantos estão aptos ao certificado (mínimo configurável, padrão 75%). Exporta planilha (CSV para Excel).
- **Sorteio** — roleta horizontal estilo caça-níquel. Filtros: todos, só aptos, ou só presentes em uma aula; opção de não repetir sorteados; histórico.
- **Dados** — nome da turma, frequência mínima, cópia de segurança e restauração.

## Publicar no GitHub Pages
1. Crie um repositório (ex.: `cbcj-2026`) e envie todos os arquivos desta pasta, mantendo a pasta `assets`.
2. Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Acesse `https://SEU-USUARIO.github.io/cbcj-2026/`. No celular, use "Adicionar à tela inicial" para abrir como aplicativo.

## Onde ficam os dados
Os dados ficam salvos no navegador do aparelho (localStorage). Use **Dados → Baixar cópia** regularmente e **Restaurar** para passar os dados para outro aparelho.

## Instalar como aplicativo
- **Android / Chrome / Edge:** botão dourado **Instalar app** no cabeçalho (ou na aba Dados).
- **iPhone:** o botão mostra o passo a passo (Safari → Compartilhar → Adicionar à Tela de Início).

## Publicar uma nova versão
1. Em `index.html`, mude `const VERSAO` e acrescente um item no topo de `NOVIDADES`.
2. Em `sw.js`, mude `const VERSAO` para o **mesmo número**.
3. Envie os arquivos ao GitHub. Quem estiver com o app aberto verá o aviso **"Nova versão disponível → Atualizar"** (ou pode tocar em *Dados → Verificar atualização*). Os dados dos alunos não são apagados.
