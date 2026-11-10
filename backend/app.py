import datetime
import functools
import os

import jwt
from flask import Flask, g, request, jsonify, send_from_directory, abort
from werkzeug.security import check_password_hash
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash


import config
import db

app = Flask(__name__)
CORS(app)
app.teardown_appcontext(db.close_db)


# ---------------------------------------------------------------------
# autenticação
# ---------------------------------------------------------------------

def gerar_token(funcionario):
    payload = {
        "id_funcionario": funcionario["id_funcionario"],
        "id_cargo": funcionario["id_cargo"],
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8),
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
                   WHERE p.id_cargo = ? AND m.nome_modulo = ?""",
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
        """SELECT f.*, c.nome_cargo 
           FROM funcionario f 
           JOIN cargo c ON c.id_cargo = f.id_cargo 
           WHERE f.email = ? AND f.status = 'Ativo'""",
        (dados.get("email"),),
    )
    if func is None or not func["senha_hash"] or not check_password_hash(func["senha_hash"], dados.get("senha", "")):
        return jsonify({"erro": "email ou senha inválidos"}), 401
    
    return jsonify({
        "token": gerar_token(func),
        "cargo": func["nome_cargo"],
        "nome": func["nome"]
    })


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
           VALUES (?, ?, ?, ?, ?, ?)""",
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
           SET nome_produto=?, id_categoria_produto=?, quantidade=?,
               unidade_medida=?, preco_unitario=?, estoque_minimo=?
           WHERE id_produto=?""",
        (
            dados["nome_produto"], dados["id_categoria_produto"], dados.get("quantidade", 0),
            dados.get("unidade_medida", "un"), dados.get("preco_unitario"), dados.get("estoque_minimo", 5),
            id_produto,
        ),
    )
    return jsonify({"status": "atualizado"})

@app.delete("/api/estoque/<int:id_produto>")
@requer_permissao("Estoque", "pode_editar")
def deletar_produto(id_produto):
    db.execute(
        "DELETE FROM produto_estoque WHERE id_produto = ?",
        (id_produto,)
    )
    return jsonify({"status": "removido"}), 200


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

# --- CRUD de Funcionários pelo Painel ---

@app.post("/api/funcionarios")
@requer_permissao("Funcionarios", "pode_editar")
def criar_funcionario_painel():
    dados = request.get_json(force=True)
    nome = dados.get("nome")
    nome_cargo = dados.get("cargo")
    telefone = dados.get("telefone")
    salario = dados.get("salario")
    status = dados.get("status", "Ativo")

    if not nome or not nome_cargo:
        return jsonify({"erro": "Nome e cargo são obrigatórios"}), 400

    cargo = db.query_one("SELECT id_cargo FROM cargo WHERE nome_cargo = ?", (nome_cargo,))
    if cargo is None:
        return jsonify({"erro": f"Cargo '{nome_cargo}' não encontrado"}), 400

    # Gera um email único temporário caso não seja informado
    timestamp_atual = datetime.datetime.now().strftime("%Y%m%d%H%M%S%f")
    email_padrao = dados.get("email") or f"{nome.lower().replace(' ', '.')}.{timestamp_atual}@giraffa.local"
    
    # Define uma senha padrão em hash caso o usuário venha a logar (senha: 12345678)
    senha_hash = generate_password_hash("12345678")

    novo_id = db.execute(
        """INSERT INTO funcionario 
           (nome, email, senha_hash, id_cargo, telefone, salario, status, data_admissao) 
           VALUES (?, ?, ?, ?, ?, ?, ?, date('now','localtime'))""",
        (nome, email_padrao, senha_hash, cargo["id_cargo"], telefone, salario, status),
    )
    return jsonify({"id_funcionario": novo_id, "status": "criado"}), 201


@app.put("/api/funcionarios/<int:id_funcionario>")
@requer_permissao("Funcionarios", "pode_editar")
def atualizar_funcionario_painel(id_funcionario):
    dados = request.get_json(force=True)
    nome = dados.get("nome")
    nome_cargo = dados.get("cargo")
    telefone = dados.get("telefone")
    salario = dados.get("salario")
    status = dados.get("status", "Ativo")

    cargo = db.query_one("SELECT id_cargo FROM cargo WHERE nome_cargo = ?", (nome_cargo,))
    if cargo is None:
        return jsonify({"erro": "Cargo inválido"}), 400

    db.execute(
        """UPDATE funcionario 
           SET nome=?, id_cargo=?, telefone=?, salario=?, status=? 
           WHERE id_funcionario=?""",
        (nome, cargo["id_cargo"], telefone, salario, status, id_funcionario),
    )
    return jsonify({"status": "atualizado"}), 200


@app.delete("/api/funcionarios/<int:id_funcionario>")
@requer_permissao("Funcionarios", "pode_editar")
def excluir_funcionario_painel(id_funcionario):
    try:
        db.execute("DELETE FROM funcionario WHERE id_funcionario = ?", (id_funcionario,))
    except Exception:
        # Se houver histórico vinculado (como registro de ponto), apenas desativa
        db.execute("UPDATE funcionario SET status = 'Desativado' WHERE id_funcionario = ?", (id_funcionario,))
    return jsonify({"status": "removido"}), 200

@app.post("/api/cadastro")
def cadastrar_funcionario():
    dados = request.get_json(force=True)
    
    nome = dados.get("nome")
    email = dados.get("email")
    senha = dados.get("senha")
    nome_cargo = dados.get("cargo")

    if not nome or not email or not senha or not nome_cargo:
        return jsonify({"erro": "Todos os campos são obrigatórios"}), 400

    cargo = db.query_one("SELECT id_cargo FROM cargo WHERE nome_cargo = ?", (nome_cargo,))
    if cargo is None:
        return jsonify({"erro": f"Cargo '{nome_cargo}' não encontrado"}), 400

    existente = db.query_one("SELECT id_funcionario FROM funcionario WHERE email = ?", (email,))
    if existente:
        return jsonify({"erro": "Este e-mail já está em uso"}), 409

    hash_senha = generate_password_hash(senha)

    novo_id = db.execute(
        "INSERT INTO funcionario (nome, email, senha_hash, id_cargo, status) VALUES (?, ?, ?, ?, 'Ativo')",
        (nome, email, hash_senha, cargo["id_cargo"]),
    )

    return jsonify({"status": "sucesso", "id_funcionario": novo_id}), 201


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
           WHERE id_funcionario = ? AND data_registro = ? AND hora_saida IS NULL""",
        (usuario["id_funcionario"], hoje),
    )
    agora = datetime.datetime.now().strftime("%H:%M:%S")

    if aberto is None:
        db.execute(
            "INSERT INTO registro_ponto (id_funcionario, data_registro, hora_entrada) VALUES (?, ?, ?)",
            (usuario["id_funcionario"], hoje, agora),
        )
        acao = "entrada registrada"
    else:
        db.execute(
            "UPDATE registro_ponto SET hora_saida = ? WHERE id_registro = ?",
            (agora, aberto["id_registro"]),
        )
        acao = "saída registrada"

    return jsonify({"status": acao, "hora": agora})

"""
CRUD do Cardápio (categoria_cardapio + item_cardapio).

Cole isso dentro do app.py de vocês, perto das rotas de /api/estoque — usa
os mesmos helpers (db.query/db.query_one/db.execute, chamados via o módulo
db importado no topo do app.py) e o mesmo decorador requer_permissao(nome_modulo,
acao) que já protege as outras rotas.

ANTES de usar, rode no banco (ver migracao_cardapio.sql):
  1) INSERT INTO modulo (nome_modulo) VALUES ('Cardapio');
  2) dar permissão de Gerente pro novo módulo (já incluído no .sql)
  3) decidir com o time o que Copeiro/Garçom/Cozinheiro podem fazer aqui e
     inserir as linhas correspondentes em permissao_cargo — enquanto não
     tiver linha pra um cargo, o decorador barra ele por padrão (fail-safe).
"""

# ---------------------------------------------------------------------
# CATEGORIAS DO CARDÁPIO
# ---------------------------------------------------------------------

@app.route("/api/cardapio/categorias", methods=["GET"])
@requer_permissao("Cardapio", "pode_visualizar")
def listar_categorias_cardapio():
    categorias = db.query("SELECT * FROM categoria_cardapio ORDER BY nome")
    return jsonify(categorias)


@app.route("/api/cardapio/categorias", methods=["POST"])
@requer_permissao("Cardapio", "pode_editar")
def criar_categoria_cardapio():
    dados = request.get_json(force=True)
    nome = dados.get("nome")
    if not nome:
        return jsonify({"erro": "nome é obrigatório"}), 400

    novo_id = db.execute(
        "INSERT INTO categoria_cardapio (nome) VALUES (?)",
        (nome,),
    )
    return jsonify({"id_categoria_cardapio": novo_id}), 201


@app.route("/api/cardapio/categorias/<int:id_categoria>", methods=["PUT"])
@requer_permissao("Cardapio", "pode_editar")
def atualizar_categoria_cardapio(id_categoria):
    dados = request.get_json(force=True)
    nome = dados.get("nome")
    if not nome:
        return jsonify({"erro": "nome é obrigatório"}), 400

    db.execute(
        "UPDATE categoria_cardapio SET nome = ? WHERE id_categoria_cardapio = ?",
        (nome, id_categoria),
    )
    return jsonify({"ok": True})


@app.route("/api/cardapio/categorias/<int:id_categoria>", methods=["DELETE"])
@requer_permissao("Cardapio", "pode_editar")
def excluir_categoria_cardapio(id_categoria):
    # se existir item_cardapio apontando pra essa categoria, a FK vai barrar
    # a exclusão (PRAGMA foreign_keys = ON) — isso é o comportamento certo:
    # evita deixar itens órfãos.
    try:
        db.execute(
            "DELETE FROM categoria_cardapio WHERE id_categoria_cardapio = ?",
            (id_categoria,),
        )
        return jsonify({"ok": True})
    except Exception:
        return jsonify({"erro": "não é possível excluir: existem itens cadastrados nessa categoria"}), 409


# ---------------------------------------------------------------------
# ITENS DO CARDÁPIO
# ---------------------------------------------------------------------

@app.route("/api/cardapio/itens", methods=["GET"])
@requer_permissao("Cardapio", "pode_visualizar")
def listar_itens_cardapio():
    itens = db.query("""
        SELECT i.*, c.nome AS nome_categoria
        FROM item_cardapio i
        JOIN categoria_cardapio c ON c.id_categoria_cardapio = i.id_categoria_cardapio
        ORDER BY c.nome, i.nome
    """)
    return jsonify(itens)


@app.route("/api/cardapio/itens", methods=["POST"])
@requer_permissao("Cardapio", "pode_editar")
def criar_item_cardapio():
    dados = request.get_json(force=True)
    campos_obrigatorios = ["nome", "preco", "id_categoria_cardapio"]
    faltando = [c for c in campos_obrigatorios if dados.get(c) in (None, "")]
    if faltando:
        return jsonify({"erro": f"campos obrigatórios faltando: {', '.join(faltando)}"}), 400

    novo_id = db.execute(
        """INSERT INTO item_cardapio
           (nome, descricao, preco, id_categoria_cardapio, disponivel, imagem_url)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            dados["nome"],
            dados.get("descricao"),
            dados["preco"],
            dados["id_categoria_cardapio"],
            1 if dados.get("disponivel", True) else 0,
            dados.get("imagem_url"),
        ),
    )
    return jsonify({"id_item_cardapio": novo_id}), 201


@app.route("/api/cardapio/itens/<int:id_item>", methods=["PUT"])
@requer_permissao("Cardapio", "pode_editar")
def atualizar_item_cardapio(id_item):
    dados = request.get_json(force=True)
    atual = db.query_one("SELECT * FROM item_cardapio WHERE id_item_cardapio = ?", (id_item,))
    if not atual:
        return jsonify({"erro": "item não encontrado"}), 404

    db.execute(
        """UPDATE item_cardapio
           SET nome = ?, descricao = ?, preco = ?, id_categoria_cardapio = ?,
               disponivel = ?, imagem_url = ?
           WHERE id_item_cardapio = ?""",
        (
            dados.get("nome", atual["nome"]),
            dados.get("descricao", atual["descricao"]),
            dados.get("preco", atual["preco"]),
            dados.get("id_categoria_cardapio", atual["id_categoria_cardapio"]),
            1 if dados.get("disponivel", atual["disponivel"]) else 0,
            dados.get("imagem_url", atual["imagem_url"]),
            id_item,
        ),
    )
    return jsonify({"ok": True})


@app.route("/api/cardapio/itens/<int:id_item>", methods=["DELETE"])
@requer_permissao("Cardapio", "pode_editar")
def excluir_item_cardapio(id_item):
    db.execute("DELETE FROM item_cardapio WHERE id_item_cardapio = ?", (id_item,))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------
# front-end (HTML/CSS/JS/imagens) servido pelo próprio Flask
# ---------------------------------------------------------------------
# Assim o site e a API ficam na mesma origem (localhost:5000 ou o endereço
# do PythonAnywhere) e o front pode chamar "/api/...". Só servimos
# extensões de site — nunca a pasta backend/, o banco (.db) ou código .py.

PASTA_SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTENSOES_PUBLICAS = {".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"}


@app.route("/")
def pagina_inicial():
    return send_from_directory(PASTA_SITE, "index.html")


@app.route("/<path:caminho>")
def arquivos_do_site(caminho):
    primeira_parte = caminho.split("/")[0].lower()
    extensao = os.path.splitext(caminho)[1].lower()
    if primeira_parte in ("api", "backend") or caminho.startswith(".") or extensao not in EXTENSOES_PUBLICAS:
        abort(404)
    return send_from_directory(PASTA_SITE, caminho)



if __name__ == "__main__":
    app.run(debug=True, port=5000)

