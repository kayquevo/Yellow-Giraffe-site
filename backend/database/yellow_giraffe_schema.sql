-- =====================================================================
-- YELLOW GIRAFFE — Modelagem do banco de dados
-- Site institucional + portal interno (funcionários, estoque, pedidos)
-- Dialeto: MySQL 8+ / MariaDB (compatível com pequenos ajustes no PostgreSQL:
--          troque AUTO_INCREMENT por GENERATED ALWAYS AS IDENTITY ou SERIAL,
--          e ENUM por um CHECK constraint ou tabela de domínio)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS yellow_giraffe
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE yellow_giraffe;

-- ---------------------------------------------------------------------
-- BLOCO 1 — EQUIPE, CARGOS E CONTROLE DE ACESSO
-- Substitui o campo livre "cargo" (hoje um texto qualquer digitado no
-- formulário) por uma tabela própria, o que permite listar cargos
-- existentes num <select> e, principalmente, amarrar permissões a eles.
-- ---------------------------------------------------------------------

CREATE TABLE cargo (
    id_cargo        INT AUTO_INCREMENT PRIMARY KEY,
    nome_cargo      VARCHAR(50)  NOT NULL UNIQUE    -- Gerente, Copeiro, Garçom, Cozinheiro...
) ENGINE=InnoDB;

CREATE TABLE funcionario (
    id_funcionario  INT AUTO_INCREMENT PRIMARY KEY,
    nome            VARCHAR(120) NOT NULL,
    telefone        VARCHAR(20),
    email           VARCHAR(120) UNIQUE,             -- necessário para o login que o README pede
    senha_hash      VARCHAR(255),                    -- NUNCA gravar a senha em texto puro (usar bcrypt/argon2)
    id_cargo        INT NOT NULL,
    salario         DECIMAL(10,2),
    data_admissao   DATE,
    status          ENUM('Ativo','Desativado') NOT NULL DEFAULT 'Ativo',
    FOREIGN KEY (id_cargo) REFERENCES cargo(id_cargo)
) ENGINE=InnoDB;

CREATE TABLE registro_ponto (
    id_registro     INT AUTO_INCREMENT PRIMARY KEY,
    id_funcionario  INT NOT NULL,
    data_registro   DATE NOT NULL,
    hora_entrada    TIME,
    hora_saida      TIME,
    FOREIGN KEY (id_funcionario) REFERENCES funcionario(id_funcionario)
) ENGINE=InnoDB;
-- Obs.: "horas trabalhadas" não é armazenado — é calculado a partir de
-- hora_entrada/hora_saida na hora da consulta (TIMEDIFF), evitando um
-- campo derivado que pode ficar desatualizado se um horário for corrigido.

CREATE TABLE escala_turno (
    id_escala       INT AUTO_INCREMENT PRIMARY KEY,
    id_funcionario  INT NOT NULL,
    data_turno      DATE NOT NULL,
    hora_inicio     TIME,
    hora_fim        TIME,
    tipo            ENUM('Trabalho','Folga') NOT NULL DEFAULT 'Trabalho',
    FOREIGN KEY (id_funcionario) REFERENCES funcionario(id_funcionario)
) ENGINE=InnoDB;
-- Cobre a "Ideia Futura: Escala & Turnos" já anotada no README do projeto.

-- ---------------------------------------------------------------------
-- BLOCO 2 — PERMISSÕES POR MÓDULO
-- Modela literalmente as regras já escritas no README ("ocultar preços
-- para o Copeiro", "Funcionários visível só para o Gerente" etc.) em vez
-- de deixar essas regras espalhadas e fixas ("hardcoded") no JavaScript.
-- ---------------------------------------------------------------------

CREATE TABLE modulo (
    id_modulo    INT AUTO_INCREMENT PRIMARY KEY,
    nome_modulo  VARCHAR(50) NOT NULL UNIQUE  -- Dashboard, Estoque, Funcionarios, Mesas, Pedidos, RH, Escala
) ENGINE=InnoDB;

CREATE TABLE permissao_cargo (
    id_cargo          INT NOT NULL,
    id_modulo         INT NOT NULL,
    pode_visualizar   BOOLEAN NOT NULL DEFAULT TRUE,
    pode_editar       BOOLEAN NOT NULL DEFAULT FALSE,
    pode_ver_valores  BOOLEAN NOT NULL DEFAULT FALSE, -- ex.: preços/total do estoque, salários
    PRIMARY KEY (id_cargo, id_modulo),
    FOREIGN KEY (id_cargo)  REFERENCES cargo(id_cargo),
    FOREIGN KEY (id_modulo) REFERENCES modulo(id_modulo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- BLOCO 3 — ESTOQUE (insumos/ingredientes da cozinha)
-- ---------------------------------------------------------------------

CREATE TABLE categoria_produto (
    id_categoria_produto  INT AUTO_INCREMENT PRIMARY KEY,
    nome                  VARCHAR(50) NOT NULL UNIQUE  -- Pães & Massas, Carnes & Queijos, Bebidas...
) ENGINE=InnoDB;

CREATE TABLE produto_estoque (
    id_produto            INT AUTO_INCREMENT PRIMARY KEY,
    nome_produto          VARCHAR(100) NOT NULL,
    id_categoria_produto  INT NOT NULL,
    quantidade            DECIMAL(10,2) NOT NULL DEFAULT 0,
    unidade_medida        VARCHAR(10)   NOT NULL DEFAULT 'un', -- kg, L, un, cx...
    preco_unitario        DECIMAL(10,2) NULL DEFAULT NULL,     -- opcional (pedido do README)
    estoque_minimo        DECIMAL(10,2) NOT NULL DEFAULT 5,    -- limite configurável de alerta
                                                                -- (hoje fixo em 5/15 direto no código)
    FOREIGN KEY (id_categoria_produto) REFERENCES categoria_produto(id_categoria_produto)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- BLOCO 4 — CARDÁPIO (o que é vendido ao cliente)
-- ---------------------------------------------------------------------

CREATE TABLE categoria_cardapio (
    id_categoria_cardapio  INT AUTO_INCREMENT PRIMARY KEY,
    nome                   VARCHAR(50) NOT NULL UNIQUE  -- Lanches, Sobremesas, Sugestões da Casa
) ENGINE=InnoDB;

CREATE TABLE item_cardapio (
    id_item_cardapio       INT AUTO_INCREMENT PRIMARY KEY,
    nome                   VARCHAR(100) NOT NULL,
    descricao              VARCHAR(255),
    preco                  DECIMAL(10,2) NOT NULL,
    id_categoria_cardapio  INT NOT NULL,
    disponivel             BOOLEAN NOT NULL DEFAULT TRUE,   -- pausar um item sem apagar o histórico
    imagem_url             VARCHAR(255),
    FOREIGN KEY (id_categoria_cardapio) REFERENCES categoria_cardapio(id_categoria_cardapio)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- BLOCO 5 — SALÃO E PEDIDOS (módulos "Mesas" e "Pedidos" do roadmap)
-- ---------------------------------------------------------------------

CREATE TABLE mesa (
    id_mesa      INT AUTO_INCREMENT PRIMARY KEY,
    numero       INT NOT NULL UNIQUE,
    capacidade   INT NOT NULL DEFAULT 4,
    status       ENUM('Livre','Ocupada','Reservada') NOT NULL DEFAULT 'Livre'
) ENGINE=InnoDB;

CREATE TABLE pedido (
    id_pedido            INT AUTO_INCREMENT PRIMARY KEY,
    id_mesa              INT NULL,          -- NULL = pedido de delivery/retirada, sem mesa associada
    id_funcionario       INT NOT NULL,      -- quem abriu/atende o pedido
    tipo                 ENUM('Local','Delivery','Retirada') NOT NULL DEFAULT 'Local',
    status               ENUM('Aberto','Em preparo','Pronto','Entregue','Cancelado')
                         NOT NULL DEFAULT 'Aberto',
    data_hora_abertura   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_hora_fechamento DATETIME NULL,
    FOREIGN KEY (id_mesa)        REFERENCES mesa(id_mesa),
    FOREIGN KEY (id_funcionario) REFERENCES funcionario(id_funcionario)
) ENGINE=InnoDB;

CREATE TABLE item_pedido (
    id_item_pedido        INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido             INT NOT NULL,
    id_item_cardapio      INT NOT NULL,
    quantidade            INT NOT NULL DEFAULT 1,
    preco_unit_no_pedido  DECIMAL(10,2) NOT NULL,  -- "congela" o preço do item na hora da venda,
                                                    -- assim reajustes futuros no cardápio não alteram
                                                    -- o valor de pedidos já fechados
    observacoes           VARCHAR(255),
    FOREIGN KEY (id_pedido)        REFERENCES pedido(id_pedido),
    FOREIGN KEY (id_item_cardapio) REFERENCES item_cardapio(id_item_cardapio)
) ENGINE=InnoDB;

-- =====================================================================
-- DADOS INICIAIS (seed) — só o essencial para o sistema já nascer usável
-- =====================================================================

INSERT INTO cargo (nome_cargo) VALUES
  ('Gerente'),
  ('Copeiro'),
  ('Garçom'),
  ('Cozinheiro');

INSERT INTO modulo (nome_modulo) VALUES
  ('Dashboard'), ('Estoque'), ('Funcionarios'), ('Mesas'), ('Pedidos'), ('RH'), ('Escala');

-- Permissões iniciais (regras do README)
-- Gerente: tudo liberado
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, TRUE, TRUE, TRUE
FROM cargo c CROSS JOIN modulo m
WHERE c.nome_cargo = 'Gerente';

-- Copeiro: vê Dashboard e Estoque, edita só o Estoque, sem ver valores
INSERT INTO permissao_cargo (id_cargo, id_modulo, pode_visualizar, pode_editar, pode_ver_valores)
SELECT c.id_cargo, m.id_modulo, TRUE, (m.nome_modulo = 'Estoque'), FALSE
FROM cargo c JOIN modulo m ON m.nome_modulo IN ('Dashboard', 'Estoque')
WHERE c.nome_cargo = 'Copeiro';

INSERT INTO categoria_produto (nome) VALUES
  ('Pães & Massas'), ('Carnes & Queijos'), ('Bebidas'), ('Hortifruti'), ('Embalagens'), ('Outros');

INSERT INTO categoria_cardapio (nome) VALUES
  ('Lanches'), ('Sobremesas'), ('Sugestões da Casa');
