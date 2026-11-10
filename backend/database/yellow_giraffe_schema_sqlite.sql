-- =====================================================================
-- YELLOW GIRAFFE — Schema convertido para SQLite
-- Mesmas tabelas e colunas do yellow_giraffe_schema.sql (MySQL), só com
-- a sintaxe adaptada: sem AUTO_INCREMENT/ENUM/ENGINE, sem CREATE DATABASE
-- (no SQLite o banco inteiro é um único arquivo).
--
-- Como aplicar:
--   sqlite3 yellow_giraffe.db < yellow_giraffe_schema_sqlite.sql
-- (se não tiver o comando sqlite3 disponível, veja a alternativa em Python
-- no comentário no fim deste arquivo)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- BLOCO 1 — EQUIPE, CARGOS E CONTROLE DE ACESSO
-- ---------------------------------------------------------------------

CREATE TABLE cargo (
    id_cargo        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_cargo      TEXT NOT NULL UNIQUE
);

CREATE TABLE funcionario (
    id_funcionario  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    telefone        TEXT,
    email           TEXT UNIQUE,
    senha_hash      TEXT,
    id_cargo        INTEGER NOT NULL,
    salario         DECIMAL(10,2),
    data_admissao   DATE,
    status          TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Desativado')),
    FOREIGN KEY (id_cargo) REFERENCES cargo(id_cargo)
);

CREATE TABLE registro_ponto (
    id_registro     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_funcionario  INTEGER NOT NULL,
    data_registro   DATE NOT NULL,
    hora_entrada    TIME,
    hora_saida      TIME,
    FOREIGN KEY (id_funcionario) REFERENCES funcionario(id_funcionario)
);

CREATE TABLE escala_turno (
    id_escala       INTEGER PRIMARY KEY AUTOINCREMENT,
    id_funcionario  INTEGER NOT NULL,
    data_turno      DATE NOT NULL,
    hora_inicio     TIME,
    hora_fim        TIME,
    tipo            TEXT NOT NULL DEFAULT 'Trabalho' CHECK (tipo IN ('Trabalho','Folga')),
    FOREIGN KEY (id_funcionario) REFERENCES funcionario(id_funcionario)
);

-- ---------------------------------------------------------------------
-- BLOCO 2 — PERMISSÕES POR MÓDULO
-- ---------------------------------------------------------------------

CREATE TABLE modulo (
    id_modulo    INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_modulo  TEXT NOT NULL UNIQUE
);

CREATE TABLE permissao_cargo (
    id_cargo          INTEGER NOT NULL,
    id_modulo         INTEGER NOT NULL,
    pode_visualizar   BOOLEAN NOT NULL DEFAULT 1,
    pode_editar       BOOLEAN NOT NULL DEFAULT 0,
    pode_ver_valores  BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (id_cargo, id_modulo),
    FOREIGN KEY (id_cargo)  REFERENCES cargo(id_cargo),
    FOREIGN KEY (id_modulo) REFERENCES modulo(id_modulo)
);

-- ---------------------------------------------------------------------
-- BLOCO 3 — ESTOQUE
-- ---------------------------------------------------------------------

CREATE TABLE categoria_produto (
    id_categoria_produto  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                  TEXT NOT NULL UNIQUE
);

CREATE TABLE produto_estoque (
    id_produto            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_produto          TEXT NOT NULL,
    id_categoria_produto  INTEGER NOT NULL,
    quantidade            DECIMAL(10,2) NOT NULL DEFAULT 0,
    unidade_medida        TEXT NOT NULL DEFAULT 'un',
    preco_unitario        DECIMAL(10,2) NULL DEFAULT NULL,
    estoque_minimo        DECIMAL(10,2) NOT NULL DEFAULT 5,
    FOREIGN KEY (id_categoria_produto) REFERENCES categoria_produto(id_categoria_produto)
);

-- ---------------------------------------------------------------------
-- BLOCO 4 — CARDÁPIO
-- ---------------------------------------------------------------------

CREATE TABLE categoria_cardapio (
    id_categoria_cardapio  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                   TEXT NOT NULL UNIQUE
);

CREATE TABLE item_cardapio (
    id_item_cardapio       INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                   TEXT NOT NULL,
    descricao              TEXT,
    preco                  DECIMAL(10,2) NOT NULL,
    id_categoria_cardapio  INTEGER NOT NULL,
    disponivel             BOOLEAN NOT NULL DEFAULT 1,
    imagem_url             TEXT,
    FOREIGN KEY (id_categoria_cardapio) REFERENCES categoria_cardapio(id_categoria_cardapio)
);

-- ---------------------------------------------------------------------
-- BLOCO 5 — SALÃO E PEDIDOS
-- ---------------------------------------------------------------------

CREATE TABLE mesa (
    id_mesa      INTEGER PRIMARY KEY AUTOINCREMENT,
    numero       INTEGER NOT NULL UNIQUE,
    capacidade   INTEGER NOT NULL DEFAULT 4,
    status       TEXT NOT NULL DEFAULT 'Livre' CHECK (status IN ('Livre','Ocupada','Reservada'))
);

CREATE TABLE pedido (
    id_pedido            INTEGER PRIMARY KEY AUTOINCREMENT,
    id_mesa              INTEGER NULL,
    id_funcionario       INTEGER NOT NULL,
    tipo                 TEXT NOT NULL DEFAULT 'Local' CHECK (tipo IN ('Local','Delivery','Retirada')),
    status               TEXT NOT NULL DEFAULT 'Aberto'
                         CHECK (status IN ('Aberto','Em preparo','Pronto','Entregue','Cancelado')),
    data_hora_abertura   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_hora_fechamento DATETIME NULL,
    FOREIGN KEY (id_mesa)        REFERENCES mesa(id_mesa),
    FOREIGN KEY (id_funcionario) REFERENCES funcionario(id_funcionario)
);

CREATE TABLE item_pedido (
    id_item_pedido        INTEGER PRIMARY KEY AUTOINCREMENT,
    id_pedido             INTEGER NOT NULL,
    id_item_cardapio      INTEGER NOT NULL,
    quantidade            INTEGER NOT NULL DEFAULT 1,
    preco_unit_no_pedido  DECIMAL(10,2) NOT NULL,
    observacoes           TEXT,
    FOREIGN KEY (id_pedido)        REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_item_cardapio) REFERENCES item_cardapio(id_item_cardapio)
);

-- =====================================================================
-- DADOS INICIAIS (seed)
-- =====================================================================

INSERT INTO cargo (nome_cargo) VALUES
  ('Gerente'), ('Copeiro'), ('Garçom'), ('Cozinheiro');

INSERT INTO modulo (nome_modulo) VALUES
  ('Dashboard'), ('Estoque'), ('Funcionarios'), ('Mesas'), ('Pedidos'), ('RH'), ('Escala'), ('Cardapio');

-- Gerente: tudo liberado
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, 1, 1, 1
FROM cargo c CROSS JOIN modulo m
WHERE c.nome_cargo = 'Gerente';

-- Copeiro: vê Dashboard e Estoque, edita só o Estoque, sem ver valores
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, 1, (m.nome_modulo = 'Estoque'), 0
FROM cargo c JOIN modulo m ON m.nome_modulo IN ('Dashboard', 'Estoque')
WHERE c.nome_cargo = 'Copeiro';

-- Garçom: só vê Dashboard, sem editar nada nem ver valores
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, 1, 0, 0
FROM cargo c JOIN modulo m ON m.nome_modulo = 'Dashboard'
WHERE c.nome_cargo = 'Garçom';

-- Cozinheiro: vê Dashboard e Estoque, sem editar nem ver valores
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, 1, 0, 0
FROM cargo c JOIN modulo m ON m.nome_modulo IN ('Dashboard', 'Estoque')
WHERE c.nome_cargo = 'Cozinheiro';

-- Copeiro, Garçom e Cozinheiro: só visualizam o Cardápio (ninguém além do
-- Gerente cria/edita/exclui categorias ou itens). O preço do cardápio é
-- público pro cliente, então pode_ver_valores fica 1 pros três.
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, 1, 0, 1
FROM cargo c CROSS JOIN modulo m
WHERE c.nome_cargo IN ('Copeiro', 'Garçom', 'Cozinheiro') AND m.nome_modulo = 'Cardapio';

INSERT INTO categoria_produto (nome) VALUES
  ('Pães & Massas'), ('Carnes & Queijos'), ('Bebidas'), ('Hortifruti'), ('Embalagens'), ('Outros');

INSERT INTO categoria_cardapio (nome) VALUES
  ('Lanches'), ('Sobremesas'), ('Sugestões da Casa');

-- Alternativa em Python, se não tiver o comando "sqlite3" disponível:
--   python -c "import sqlite3; sqlite3.connect('yellow_giraffe.db').executescript(open('yellow_giraffe_schema_sqlite.sql', encoding='utf-8').read())"
