# Quadro de PIX

Quadro para controlar os PIX a pagar de cada estabelecimento (Leão do Parque, Pier 49, Padaria Gaúcha Centro e Cassino). Cada estabelecimento entra com a sua senha (login do Firebase) e cadastra os PIX; o chefe marca como feito, vê o relatório e o histórico de atividades. Os dados ficam no Firebase Firestore e sincronizam em tempo real.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `index.html` | Página principal. Carrega o Firebase, o CSS e o app compilado. |
| `src/app.jsx` | Código do app (React). **É aqui que se edita.** |
| `src/styles.css` | Estilos base e fontes; o resto vem das classes do Tailwind. |
| `dist/app.js`, `dist/styles.css` | Arquivos gerados pelo build. Não edite à mão. |
| `.github/workflows/build.yml` | Recompila `dist/` sozinho a cada push na `main`. |

Estabelecimentos, cores e e-mails de login ficam na lista `EMPRESAS` no começo de `src/app.jsx`; o e-mail do chefe é `CHEFE_EMAIL`.

## Login e regras do banco

Cada estabelecimento e o chefe têm uma conta no Firebase Authentication (e-mail e senha). Na tela inicial a pessoa escolhe o estabelecimento e digita só a senha; o aparelho fica logado até alguém clicar em "Sair".

Para criar as contas: no console do Firebase, **Authentication > Sign-in method**, ative **E-mail/senha**; depois, em **Authentication > Users > Add user**, crie uma conta para cada e-mail abaixo, com a senha que quiser. Os e-mails não precisam existir de verdade (por isso "Esqueci a senha" não existe: para trocar uma senha, use o console).

| Conta | E-mail |
| --- | --- |
| Leão do Parque | `leao@quadro-pix.firebaseapp.com` |
| Pier 49 | `pier49@quadro-pix.firebaseapp.com` |
| Padaria Centro | `centro@quadro-pix.firebaseapp.com` |
| Padaria Cassino | `cassino@quadro-pix.firebaseapp.com` |
| Chefe | `chefe@quadro-pix.firebaseapp.com` |

Depois, cole o conteúdo de `firestore.rules` em **Firestore Database > Regras** e publique. As regras só deixam essas contas ler o quadro; cada estabelecimento só mexe na própria coluna, e só o chefe marca como feito, apaga e vê o histórico.

## Editando

**Pelo GitHub (sem instalar nada):** edite `src/app.jsx` no site e faça o commit na `main`. A Action "Build" recompila `dist/` e faz um commit "Recompila dist/" em cerca de um minuto. Espere esse commit antes de testar o site.

**No computador:** precisa do Node 20 ou mais novo.

```bash
npm install
npm run build      # gera dist/app.js e dist/styles.css
python3 -m http.server 8000   # abra http://localhost:8000
```

Durante o desenvolvimento, `npm run dev` recompila o JS a cada alteração (rode `npm run build:css` se usar classes novas do Tailwind).

## Publicando

O site é estático: basta publicar a raiz do repositório (`index.html` mais a pasta `dist/`) em qualquer hospedagem, como GitHub Pages ou Firebase Hosting. Não é preciso rodar nada no servidor.

## Relatório e backup

Na aba Relatório, o chefe pode exportar os PIX filtrados em CSV (abre direto no Excel). Para usar "Zerar relatórios" é obrigatório baixar antes um backup em CSV com todos os PIX.
