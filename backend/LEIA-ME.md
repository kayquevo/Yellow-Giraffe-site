# Backend Yellow Giraffe (Flask + SQLite)

API que o front-end (`login.js`, `cadastro.js`, `script.js`) já consome
via `fetch()`: login/cadastro, estoque, funcionários, registro de ponto e
cardápio — tudo com permissões por cargo (`Gerente`, `Copeiro`, `Garçom`,
`Cozinheiro`), guardadas na tabela `permissao_cargo`.

## 1. Instalar as dependências

```
cd backend
pip install -r requirements.txt
```

## 2. Criar o banco local

O banco (`yellow_giraffe.db`) **não fica no GitHub** — cada pessoa cria o
seu. De dentro da pasta `backend`:

```
python -c "import sqlite3; sqlite3.connect('yellow_giraffe.db').executescript(open('database/yellow_giraffe_schema_sqlite.sql', encoding='utf-8').read())"
```

Isso já cria os cargos, módulos e permissões (incluindo o módulo
Cardápio). Se o comando `sqlite3` estiver disponível no seu sistema,
também funciona:

```
sqlite3 yellow_giraffe.db < database/yellow_giraffe_schema_sqlite.sql
```

## 3. Criar um funcionário para conseguir logar

O schema cria os cargos e as permissões, mas nenhum funcionário com
e-mail/senha — sem isso não dá pra testar o login. Rode:

```
python criar_usuario.py
```

e responda nome, e-mail, senha e o cargo (`Gerente`, `Copeiro`, `Garçom`
ou `Cozinheiro`). Se quiser os três cargos de teste de uma vez (senha
`teste123` pra todos), rode `python criar_usuarios_teste.py`.

## 4. Rodar o servidor

```
python app.py
```

Ele sobe em `http://localhost:5000` e já serve o site junto: abra
`http://localhost:5000` no navegador (index, login, dashboard...). Só são
servidos HTML/CSS/JS/imagens — a pasta `backend/` e o `.db` nunca ficam
acessíveis pela web. Se preferir abrir os HTML direto do disco ou pelo
Live Server (porta 5500), também funciona: o `API_URL` dos `.js` detecta
isso e fala com `localhost:5000`.

## 5. Testar

Com `curl` (no PowerShell, use `curl.exe` e prefira salvar o corpo num
arquivo `.json` com `-d "@arquivo.json"` em vez de tentar escapar aspas
na linha de comando — evita um monte de dor de cabeça):

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","senha":"sua_senha"}'

curl http://localhost:5000/api/estoque \
  -H "Authorization: Bearer SEU_TOKEN"

curl -X POST http://localhost:5000/api/estoque \
  -H "Authorization: Bearer SEU_TOKEN" -H "Content-Type: application/json" \
  -d '{"nome_produto":"Pao sirio","id_categoria_produto":1,"quantidade":20,"unidade_medida":"un"}'

curl -X POST http://localhost:5000/api/ponto \
  -H "Authorization: Bearer SEU_TOKEN"

curl http://localhost:5000/api/cardapio/itens \
  -H "Authorization: Bearer SEU_TOKEN"
```

Se o funcionário usado for `Copeiro` ou `Cozinheiro`, repare que o
`preco_unitario` some da resposta de `/api/estoque` — é a regra
`pode_ver_valores` em ação. Tentando mexer num módulo sem permissão
(por exemplo `Garçom` chamando `/api/funcionarios`), a resposta deve ser
`403`.

## Status atual

Já testado e funcionando: login/cadastro, estoque (CRUD completo),
funcionários (CRUD completo), ponto (entrada/saída) e cardápio (CRUD de
categorias e itens) — todos com permissão por cargo validada.

Fora de escopo por enquanto: Mesas,
Pedidos e Escalas/turnos.