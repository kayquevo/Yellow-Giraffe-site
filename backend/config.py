import os

# Pode editar os valores diretamente aqui, ou definir como variáveis de
# ambiente (export DB_PASSWORD=... no terminal) antes de rodar o app.py.

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "yellow_giraffe")

# Chave usada para assinar o token de login (JWT). Troque por qualquer
# string longa e aleatória antes de usar isso fora do seu computador.
JWT_SECRET = os.environ.get("JWT_SECRET", "troque-essa-chave-antes-de-usar-de-verdade")
