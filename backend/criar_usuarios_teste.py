# -*- coding: utf-8 -*-
"""
Cria os 3 funcionários de teste (Copeiro, Garçom, Cozinheiro) pra testar as
permissões de cada cargo.

Por que o script anterior quebrou: ao comparar nome_cargo == "Garçom" dentro
de um terminal do Windows, a codificação do console (geralmente cp1252, não
UTF-8) pode corromper o caractere "ç" antes mesmo de chegar no Python,
fazendo a busca por nome falhar. Esse script evita o problema inteiramente:
em vez de comparar pelo nome acentuado, usa o id_cargo direto, na mesma
ordem em que o schema inseriu os cargos (Gerente=1, Copeiro=2, Garçom=3,
Cozinheiro=4).

Rode de dentro da pasta backend:
    python criar_usuarios_teste.py
"""
import sqlite3
from werkzeug.security import generate_password_hash

DB_PATH = "yellow_giraffe.db"  # ajuste se o arquivo estiver em outro lugar

# Mesma ordem do INSERT INTO cargo (...) do schema. Se vocês mudaram a ordem
# dos INSERTs, confira com: SELECT id_cargo, nome_cargo FROM cargo;
ID_CARGO_COPEIRO = 2
ID_CARGO_GARCOM = 3
ID_CARGO_COZINHEIRO = 4

USUARIOS = [
    {"nome": "Teste Copeiro",    "email": "copeiro.teste@yellowgiraffe.com",    "senha": "teste123", "id_cargo": ID_CARGO_COPEIRO},
    {"nome": "Teste Garcom",     "email": "garcom.teste@yellowgiraffe.com",     "senha": "teste123", "id_cargo": ID_CARGO_GARCOM},
    {"nome": "Teste Cozinheiro", "email": "cozinheiro.teste@yellowgiraffe.com", "senha": "teste123", "id_cargo": ID_CARGO_COZINHEIRO},
]

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Confere que os ids batem com os nomes esperados antes de criar qualquer coisa
cargos_no_banco = dict(cur.execute("SELECT id_cargo, nome_cargo FROM cargo").fetchall())
print("Cargos encontrados no banco:", cargos_no_banco)

for u in USUARIOS:
    try:
        senha_hash = generate_password_hash(u["senha"])
        cur.execute(
            "INSERT INTO funcionario (nome, email, senha_hash, id_cargo, status) "
            "VALUES (?, ?, ?, ?, 'Ativo')",
            (u["nome"], u["email"], senha_hash, u["id_cargo"]),
        )
        con.commit()
        print(f"Criado: {u['nome']} -> id={cur.lastrowid}, id_cargo={u['id_cargo']} ({cargos_no_banco.get(u['id_cargo'])})")
    except sqlite3.IntegrityError as e:
        con.rollback()
        print(f"Pulei {u['nome']} ({u['email']}): já existe ou erro de integridade ({e})")

con.close()

print("\nSenha de todos os usuários de teste: teste123")
print("Confira o resultado com: SELECT id_funcionario, nome, email, id_cargo FROM funcionario;")
