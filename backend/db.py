import sqlite3
from flask import g

import config


def get_db():
    """Abre (ou reaproveita) a conexão SQLite para a requisição atual."""
    if "db" not in g:
        g.db = sqlite3.connect(config.DB_PATH)
        g.db.row_factory = sqlite3.Row  # permite acessar colunas por nome, como um dicionário
        g.db.execute("PRAGMA foreign_keys = ON")  # o SQLite não aplica FKs por padrão
    return g.db


def close_db(exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query(sql, params=()):
    """SELECT que retorna uma lista de dicionários (uma linha = um dict)."""
    db = get_db()
    cur = db.execute(sql, params)
    return [dict(row) for row in cur.fetchall()]


def query_one(sql, params=()):
    linhas = query(sql, params)
    return linhas[0] if linhas else None


def execute(sql, params=()):
    """INSERT/UPDATE/DELETE. Devolve o id gerado (no caso de INSERT)."""
    db = get_db()
    cur = db.execute(sql, params)
    novo_id = cur.lastrowid
    db.commit()
    return novo_id
