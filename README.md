# CBCJ 2026 · Frequência

App de **matrículas, frequência e sorteio** do Curso Bíblico Conhecendo Jesus — Igreja de Cristo em Riacho da Cruz.
Os dados ficam na nuvem (Firebase), iguais em todos os aparelhos, e o app funciona sem internet: sincroniza quando a conexão volta.

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `index.html` | Telas e visual do app |
| `app.js` | Funcionamento das telas (matrículas, chamada, frequência, sorteio) |
| `nuvem.js` | Comunicação com o Firebase (login e banco de dados) |
| `firebase-config.js` | Dados do projeto Firebase |
| `firestore.rules` | Quem pode acessar os dados (cole no Firebase, veja abaixo) |
| `versao.json` | Número da versão publicada (aviso de atualização) |
| `sw.js`, `manifest.json`, `assets/` | Instalação como app e imagens |

## Configurar o Firebase (uma vez)
Projeto: `cbcj-frequencia-sorteio` (exclusivo do curso).

1. **Authentication → Método de login:** ative **E-mail/senha**.
2. **Authentication → Usuários → Adicionar usuário:** crie o login de quem vai usar o app.
3. **Authentication → Configurações → Domínios autorizados:** adicione `SEU-USUARIO.github.io`.
4. **Firestore Database → Criar banco de dados:** local `southamerica-east1 (São Paulo)`, modo produção.
5. **Firestore Database → Regras:** apague o conteúdo, cole o arquivo `firestore.rules` inteiro e clique em **Publicar**.

Para liberar outro professor: crie o usuário dele (passo 2) e acrescente o e-mail na lista do `firestore.rules`, publicando de novo.

## Publicar no GitHub Pages
1. Envie todos os arquivos desta pasta ao repositório, mantendo a pasta `assets`.
2. **Settings → Pages:** *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Acesse `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/` e entre com o e-mail e senha criados.

## Dados da versão anterior
Ao entrar pela primeira vez num aparelho que tinha matrículas salvas na versão anterior (sem nuvem), o app pergunta se quer **enviar esses dados para a nuvem**.

## Instalar como aplicativo
- **Android / Chrome / Edge:** botão dourado **Instalar app** no cabeçalho (ou na aba Dados).
- **iPhone:** o botão mostra o passo a passo (Safari → Compartilhar → Adicionar à Tela de Início).

## Publicar uma nova versão
1. Em `app.js`, mude `const VERSAO` (ex.: `'2.1.0'`) e acrescente um item no topo de `NOVIDADES`.
2. Em `versao.json`, coloque o **mesmo número**: `{"versao": "2.1.0"}`.
3. Envie os arquivos ao GitHub. Quem abrir o app verá **"Nova versão disponível → Atualizar"**. Os dados não são afetados.
