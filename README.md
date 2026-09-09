# StudyMais

Aplicação web para organização da rotina de estudos. O StudyMais reúne tarefas, matérias, cronograma, cronômetro de foco, progresso, conquistas e configurações da conta em uma única interface.

## Funcionalidades

- Cadastro, login e logout.
- Persistência da sessão por token JWT no navegador.
- Recuperação automática da sessão ao reabrir o site enquanto o token estiver válido.
- Cadastro, edição e exclusão de matérias.
- Cadastro, edição e exclusão de tarefas.
- Calendário mensal para organizar tarefas por data.
- Cadastro e gerenciamento de plataformas de estudo.
- Cronômetro de foco e registro do tempo estudado.
- Sistema de XP e níveis.
- Sequência de estudos por dia ativo.
- Conquistas baseadas em tarefas, XP, tempo e sequência.
- Perfil com nome, e-mail, senha e foto.
- Preferências de tema e rotina de estudos.
- Área visual do StudyMais Premium para criação de cronograma.

## Tecnologias

- HTML5
- CSS3
- JavaScript puro, sem framework
- API REST consumida com `fetch`
- JWT para autenticação
- `localStorage` para token, tema e algumas preferências locais

## Como executar

O projeto não possui dependências de Node.js nem etapa de compilação. Ele pode ser executado como uma página estática, mas é recomendado usar um servidor local para evitar restrições do navegador relacionadas a arquivos locais e requisições HTTP.

### Opção 1: VS Code com Live Server

1. Abra a pasta do projeto no VS Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito em `index.html`.
4. Selecione **Open with Live Server**.
5. Acesse o endereço local exibido pela extensão.

### Opção 2: servidor HTTP com Python

Com Python instalado, execute na pasta do projeto:

```bash
python -m http.server 5500
```

Depois abra:

```text
http://localhost:5500
```

## API

O front-end está configurado para usar a API abaixo:

```text
https://studymais.onrender.com/api
```

Essa URL está definida em `services/api.js`, na constante `API_BASE_URL`.

### Recursos utilizados

| Recurso | Operações |
| --- | --- |
| `/auth/login` | Login |
| `/usuarios` | Cadastro e carregamento do usuário autenticado |
| `/usuarios/{id}` | Atualização e exclusão da conta |
| `/usuarios/{id}/senha` | Alteração de senha |
| `/usuarios/{id}/foto` | Upload e remoção da foto |
| `/materias` | Listagem, criação, edição e exclusão |
| `/tarefas` | Listagem, criação, edição e exclusão |
| `/plataformas` | Listagem, criação, edição e exclusão |

As rotas protegidas recebem o token no cabeçalho:

```http
Authorization: Bearer <token>
```

## Autenticação e sessão

Após o login, o token JWT é salvo com a chave `studymais_token` no `localStorage`. Ao abrir o site novamente, `auth.js` tenta usar esse token para carregar o usuário atual.

A sessão é encerrada quando:

- o usuário clica em **Sair**;
- a API retorna `401` ou `403`;
- o token não existe ou está expirado;
- o navegador limpa os dados do site.

A senha não é armazenada no `localStorage`. Ela permanece apenas em memória durante a sessão atual. Por isso, depois de recarregar a página, a navegação continua funcionando com o token, mas algumas atualizações de progresso podem aguardar um novo login enquanto a API exigir a senha em toda atualização de usuário.

## Sequência de estudos

A sequência é aumentada quando o usuário conclui uma tarefa. A mesma data não é contabilizada novamente ao recarregar ou reabrir o site.

A data do último dia ativo é mantida localmente com uma chave específica do usuário. Para que a sequência seja totalmente confiável entre dispositivos e consiga detectar dias pulados, o back-end deve armazenar também a data da última atividade, por exemplo, em um campo `ultimaAtividade`.

## Estrutura do projeto

```text
studymaiss/
├── index.html              # Estrutura da interface e modais
├── style.css               # Estilos, temas e responsividade
├── auth.js                 # Login, cadastro, sessão e logout
├── calendario.js            # Navegação entre páginas e calendário
├── dados.js                 # Matérias, tarefas e plataformas
├── perfil.js                # Perfil, foto e preferências da conta
├── gamificacao.js           # XP, níveis, sequência e conquistas
├── conquistas.js            # Renderização de badges/conquistas
├── cronometro.js            # Cronômetro e registro de tempo
└── services/
    └── api.js               # Cliente HTTP e serviços da API
```

Os scripts são carregados nesta ordem em `index.html`:

1. `services/api.js`
2. `auth.js`
3. módulos de interface e dados

Essa ordem é importante porque os módulos dependem de `window.StudyMaisAPI` e `window.StudyMaisAuth`.

## Persistência local

Os dados principais do usuário, tarefas, matérias, plataformas, XP e conquistas ficam na API. O navegador armazena apenas dados auxiliares, como:

- `studymais_token`: token JWT da sessão;
- `studymais-theme`: tema selecionado;
- `studymais_goal`: objetivo pessoal;
- `studymais_settings`: preferências locais;
- `studymais_ultimo_dia_ativo_{id}`: data local usada para evitar duplicidade na sequência.

Limpar os dados do site pode remover a sessão e essas preferências locais.

## Desenvolvimento

O projeto usa JavaScript no escopo global para compartilhar serviços entre os módulos. Ao alterar um arquivo:

1. Atualize o servidor local ou recarregue a página.
2. Verifique o Console do navegador para erros.
3. Confirme no painel Network se as chamadas à API retornam sucesso.
4. Teste login, logout, recarregamento e expiração de sessão.
5. Ao alterar gamificação, teste concluir e reabrir tarefas no mesmo dia.

## Limitações conhecidas

- Não há configuração de ambiente para trocar a URL da API; ela está definida diretamente em `services/api.js`.
- O front-end depende da disponibilidade da API hospedada no Render.
- O token JWT depende da validade configurada no back-end.
- A API exige a senha no payload de algumas atualizações de usuário, o que limita a sincronização automática de progresso após um recarregamento.
- A sequência ainda usa um marcador local; a solução definitiva requer persistir a data da última atividade no servidor.
- Não há testes automatizados configurados no repositório.

## Segurança

- Não salve senhas no `localStorage`.
- Use HTTPS em produção.
- Configure expiração adequada para o JWT.
- Para sessões duradouras, prefira access token curto com refresh token seguro, em vez de aumentar indefinidamente a validade do JWT.
- Valide autenticação e autorização também no back-end; o front-end não deve ser considerado uma camada de segurança.
