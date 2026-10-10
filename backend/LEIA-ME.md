# Backend Yellow Giraffe (Flask + MySQL)

Implementa, como API, as funções que hoje vivem só no `localStorage` do
html: login, estoque (listar/criar/editar) e funcionários (listar),
além do registro de ponto. 

## 1. Instalar as dependências

```
cd backend
pip install -r requirements.txt
```

## 2. Configurar a conexão com o MySQL

```
DB_PASSWORD="senha"
python app.py
```

## 3. Criar um funcionário para conseguir logar

O `yellow_giraffe_schema.sql` cria os cargos e as permissões, mas não
cria nenhum funcionário com e-mail/senha — sem isso não dá pra testar o
login. Rode:

```
python criar_usuario.py
```

e responda nome, e-mail, senha e o cargo (`Gerente` ou `Copeiro`, que já
existem se você rodou o script completo).

## 4. Rodar o servidor

```
python app.py
```

Ele sobe em `http://localhost:5000`.

## 5. Testar

Com `curl`:

```bash
# login — guarda o token que vier na resposta
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","senha":"sua_senha"}'

# listar estoque (troque SEU_TOKEN pelo token do passo anterior)
curl http://localhost:5000/api/estoque \
  -H "Authorization: Bearer SEU_TOKEN"

# criar um produto no estoque
curl -X POST http://localhost:5000/api/estoque \
  -H "Authorization: Bearer SEU_TOKEN" -H "Content-Type: application/json" \
  -d '{"nome_produto":"Pao sirio","id_categoria_produto":1,"quantidade":20,"unidade_medida":"un"}'

# bater o ponto (primeira chamada no dia = entrada, segunda = saida)
curl -X POST http://localhost:5000/api/ponto \
  -H "Authorization: Bearer SEU_TOKEN"
```

Se o funcionário usado for `Copeiro`, repare que o `preco_unitario` some
da resposta de `/api/estoque` — é a regra `pode_ver_valores` em ação. Se
usar um cargo sem permissão no módulo Funcionários, `/api/funcionarios`
deve devolver `403`.

## O que falta pra isso virar o site de verdade

Isto é só a API. HTML ainda lê e grava direto no
`localStorage` — o próximo passo é trocar essas partes do JavaScript por
chamadas `fetch()` pros endereços acima, guardar o token (por exemplo em
`sessionStorage`, só ele, nunca a senha) depois do login, e esconder
no próprio HTML as abas que a permissão não libera. 
