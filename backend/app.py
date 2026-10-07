import datetime
import functools

import jwt
from flask import Flask, g, request, jsonify
from werkzeug.security import check_password_hash

import config
import db

app = Flask(__name__)
app.teardown_appcontext(db.close_db)


# ---------------------------------------------------------------------
# autenticação
# ---------------------------------------------------------------------

def gerar_token(funcionario):
    payload = {
        "id_funcionario": funcionario["id_funcionario"],
        "id_cargo": funcionario["id_cargo"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def usuario_logado():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        return jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def requer_permissao(nome_modulo, acao="pode_visualizar"):
    """Decorador de rota: só deixa passar quem está logado E cujo cargo
    tem a permissão pedida (pode_visualizar / pode_editar / pode_ver_valores)
    para o módulo informado, de acordo com a tabela permissao_cargo."""
    def decorador(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            usuario = usuario_logado()
            if usuario is None:
                return jsonify({"erro": "não autenticado"}), 401
            linha = db.query_one(
                """SELECT p.pode_visualizar, p.pode_editar, p.pode_ver_valores
                   FROM permissao_cargo p
                   JOIN modulo m ON m.id_modulo = p.id_modulo
                   WHERE p.id_cargo = %s AND m.nome_modulo = %s""",
                (usuario["id_cargo"], nome_modulo),
            )
            if linha is None or not linha[acao]:
                return jsonify({"erro": "sem permissão"}), 403
            g.usuario = usuario
            g.permissao = linha
            return func(*args, **kwargs)
        return wrapper
    return decorador


@app.post("/api/login")
def login():
    dados = request.get_json(force=True)
    func = db.query_one(
        "SELECT * FROM funcionario WHERE email = %s AND status = 'Ativo'",
        (dados.get("email"),),
    )
    if func is None or not func["senha_hash"] or not check_password_hash(func["senha_hash"], dados.get("senha", "")):
        return jsonify({"erro": "email ou senha inválidos"}), 401
    return jsonify({"token": gerar_token(func)})


# ---------------------------------------------------------------------
# estoque
# ---------------------------------------------------------------------

@app.get("/api/estoque")
@requer_permissao("Estoque", "pode_visualizar")
def listar_estoque():
    produtos = db.query(
        """SELECT p.id_produto, p.nome_produto, c.nome AS categoria,
                  p.quantidade, p.unidade_medida, p.estoque_minimo, p.preco_unitario
           FROM produto_estoque p
           JOIN categoria_produto c ON c.id_categoria_produto = p.id_categoria_produto"""
    )
    if not g.permissao["pode_ver_valores"]:
        for item in produtos:
            item.pop("preco_unitario", None)
    return jsonify(produtos)


@app.post("/api/estoque")
@requer_permissao("Estoque", "pode_editar")
def criar_produto():
    dados = request.get_json(force=True)
    novo_id = db.execute(
        """INSERT INTO produto_estoque
           (nome_produto, id_categoria_produto, quantidade, unidade_medida, preco_unitario, estoque_minimo)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (
            dados["nome_produto"], dados["id_categoria_produto"], dados.get("quantidade", 0),
            dados.get("unidade_medida", "un"), dados.get("preco_unitario"), dados.get("estoque_minimo", 5),
        ),
    )
    return jsonify({"id_produto": novo_id}), 201


@app.put("/api/estoque/<int:id_produto>")
@requer_permissao("Estoque", "pode_editar")
def atualizar_produto(id_produto):
    dados = request.get_json(force=True)
    db.execute(
        """UPDATE produto_estoque
           SET nome_produto=%s, id_categoria_produto=%s, quantidade=%s,
               unidade_medida=%s, preco_unitario=%s, estoque_minimo=%s
           WHERE id_produto=%s""",
        (
            dados["nome_produto"], dados["id_categoria_produto"], dados.get("quantidade", 0),
            dados.get("unidade_medida", "un"), dados.get("preco_unitario"), dados.get("estoque_minimo", 5),
            id_produto,
        ),
    )
    return jsonify({"status": "atualizado"})


# ---------------------------------------------------------------------
# funcionários
# ---------------------------------------------------------------------

@app.get("/api/funcionarios")
@requer_permissao("Funcionarios", "pode_visualizar")
def listar_funcionarios():
    funcs = db.query(
        """SELECT f.id_funcionario, f.nome, f.telefone, f.status,
                  f.salario, c.nome_cargo
           FROM funcionario f JOIN cargo c ON c.id_cargo = f.id_cargo"""
    )
    if not g.permissao["pode_ver_valores"]:
        for f in funcs:
            f.pop("salario", None)
    return jsonify(funcs)


# ---------------------------------------------------------------------
# ponto — qualquer funcionário logado pode bater o próprio ponto
# ---------------------------------------------------------------------

@app.post("/api/ponto")
def bater_ponto():
    usuario = usuario_logado()
    if usuario is None:
        return jsonify({"erro": "não autenticado"}), 401

    hoje = datetime.date.today().isoformat()
    aberto = db.query_one(
        """SELECT * FROM registro_ponto
           WHERE id_funcionario = %s AND data_registro = %s AND hora_saida IS NULL""",
        (usuario["id_funcionario"], hoje),
    )
    agora = datetime.datetime.now().strftime("%H:%M:%S")

    if aberto is None:
        db.execute(
            "INSERT INTO registro_ponto (id_funcionario, data_registro, hora_entrada) VALUES (%s, %s, %s)",
            (usuario["id_funcionario"], hoje, agora),
        )
        acao = "entrada registrada"
    else:
        db.execute(
            "UPDATE registro_ponto SET hora_saida = %s WHERE id_registro = %s",
            (agora, aberto["id_registro"]),
        )
        acao = "saída registrada"

    return jsonify({"status": acao, "hora": agora})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
