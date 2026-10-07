import pymysql
import pymysql.cursors
from flask import g

import config


def get_db():
    """Abre (ou reaproveita) uma conexão MySQL para a requisição atual."""
    if "db" not in g:
        g.db = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )
    return g.db


def close_db(exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query(sql, params=()):
    """SELECT que retorna uma lista de dicionários (uma linha = um dict)."""
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def query_one(sql, params=()):
    linhas = query(sql, params)
    return linhas[0] if linhas else None


def execute(sql, params=()):
    """INSERT/UPDATE/DELETE. Devolve o id gerado (no caso de INSERT)."""
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        novo_id = cur.lastrowid
    db.commit()
    return novo_id
