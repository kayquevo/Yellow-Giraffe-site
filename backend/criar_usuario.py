"""
Cria (ou atualiza) um funcionário com senha em hash, para dar pra testar
o /api/login. Rode: python criar_usuario.py
"""
from werkzeug.security import generate_password_hash
import db
from app import app  # só para ter o contexto da aplicação (g, config)

with app.app_context():
    nome = input("Nome: ")
    email = input("Email: ")
    senha = input("Senha (vai ser transformada em hash, não fica salva como texto puro): ")
    nome_cargo = input("Cargo (precisa já existir na tabela cargo, ex: Gerente): ")

    cargo = db.query_one("SELECT id_cargo FROM cargo WHERE nome_cargo = %s", (nome_cargo,))
    if cargo is None:
        print(f"Cargo '{nome_cargo}' não encontrado. Cargos existentes:")
        for c in db.query("SELECT nome_cargo FROM cargo"):
            print(" -", c["nome_cargo"])
        raise SystemExit(1)

    existente = db.query_one("SELECT id_funcionario FROM funcionario WHERE email = %s", (email,))
    hash_senha = generate_password_hash(senha)

    if existente:
        db.execute("UPDATE funcionario SET senha_hash = %s WHERE id_funcionario = %s",
                   (hash_senha, existente["id_funcionario"]))
        print(f"Senha atualizada para o funcionário existente (id {existente['id_funcionario']}).")
    else:
        novo_id = db.execute(
            "INSERT INTO funcionario (nome, email, senha_hash, id_cargo, status) VALUES (%s, %s, %s, %s, 'Ativo')",
            (nome, email, hash_senha, cargo["id_cargo"]),
        )
        print(f"Funcionário criado com id {novo_id}.")
