import os

# Caminho do arquivo do banco SQLite. Por padrão fica na mesma pasta do
# backend (ao lado deste arquivo), mas pode ser trocado por uma variável
# de ambiente (set DB_PATH=... / export DB_PATH=...) se preferir outro
# lugar, por exemplo no PythonAnywhere.
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "yellow_giraffe.db"),
)

# Chave usada para assinar o token de login (JWT). Troque por qualquer
# string longa e aleatória antes de usar isso fora do seu computador —
# e nunca deixe a chave real escrita aqui se o repositório for público.
JWT_SECRET = os.environ.get("JWT_SECRET", "troque-essa-chave-antes-de-usar-de-verdade")
