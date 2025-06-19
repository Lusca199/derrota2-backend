/* ==========================================================================
   0. PRÉ-REQUISITO – habilite extensões úteis
   ========================================================================== */
CREATE EXTENSION IF NOT EXISTS citext;           -- e-mails case-insensitive
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS btree_gin;        -- GIN/GIN for composites
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- fuzzy search

/* ==========================================================================
   1. TIPOS ENUM
   ========================================================================== */
CREATE TYPE visibilidade_enum AS ENUM ('PUBLICO','SEGUIDORES','PRIVADO');
CREATE TYPE status_mod_enum   AS ENUM ('PENDENTE','APROVADO','REMOVIDO');
CREATE TYPE tipo_midia_enum   AS ENUM ('IMAGE','VIDEO','GIF');
CREATE TYPE tipo_reacao_enum  AS ENUM ('CURTIR','DESCURTIR');
CREATE TYPE tipo_evento_enum  AS ENUM ('POST_CREATED','COMMENT_CREATED',
                                       'POST_LIKED','FOLLOWED');
CREATE TYPE tipo_notif_enum   AS ENUM ('FOLLOW','MENCION','LIKE','REPLY');

/* ==========================================================================
   2. TABELAS “CORE” (ACID)
   ========================================================================== */
CREATE TABLE usuario (
  id_usuario       BIGSERIAL PRIMARY KEY,
  nome             VARCHAR(60),
  email            CITEXT UNIQUE NOT NULL,
  senha_hash       VARCHAR(255)        NOT NULL,
  telefone         VARCHAR(20),
  data_nasc        DATE,
  localizacao      VARCHAR(100),
  biografia        TEXT,
  foto_perfil_url  TEXT,
  criado_em        TIMESTAMPTZ         DEFAULT now()
);

CREATE TABLE configuracao_usuario (
  id_usuario          BIGINT PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  autenticacao_2fa    BOOLEAN DEFAULT FALSE,
  tema                VARCHAR(30),
  notificacoes_ativas BOOLEAN DEFAULT TRUE,
  visibilidade_padrao visibilidade_enum DEFAULT 'PUBLICO'
);

CREATE TABLE relacao_usuario (
  seguidor_id  BIGINT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  seguido_id   BIGINT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  bloqueado    BOOLEAN DEFAULT FALSE,
  data_relacao TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (seguidor_id, seguido_id)
);

/* --------------------------------------------------------------------------
   Publicações e comentários — particionaremos por mês
   -------------------------------------------------------------------------- */
CREATE TABLE publicacao (
  id_pub       BIGSERIAL,
  autor_id     BIGINT     NOT NULL REFERENCES usuario(id_usuario),
  texto        VARCHAR(280),
  visibilidade visibilidade_enum DEFAULT 'PUBLICO',
  status_mod   status_mod_enum   DEFAULT 'PENDENTE',
  editada      BOOLEAN          DEFAULT FALSE,
  criado_em    TIMESTAMPTZ      DEFAULT now(),
  PRIMARY KEY (id_pub)          
);

CREATE TABLE comentario (
  id_coment      BIGSERIAL,
  autor_id       BIGINT NOT NULL REFERENCES usuario(id_usuario),
  pub_id         BIGINT NOT NULL,
  coment_pai_id  BIGINT,
  texto          VARCHAR(280),
  nivel          SMALLINT CHECK (nivel BETWEEN 1 AND 5),
  status_mod     status_mod_enum DEFAULT 'PENDENTE',
  editado        BOOLEAN DEFAULT FALSE,
  criado_em      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id_coment),
  FOREIGN KEY (pub_id) REFERENCES publicacao(id_pub) 
        ON DELETE CASCADE,
  FOREIGN KEY (coment_pai_id) REFERENCES comentario(id_coment) ON DELETE CASCADE
);

CREATE TABLE reacao (
  usuario_id BIGINT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  alvo_id    BIGINT,                 -- id da publicação OU comentário
  alvo_tipo  VARCHAR(7) CHECK (alvo_tipo IN ('POST','COMMENT')),
  tipo       tipo_reacao_enum,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (usuario_id, alvo_id, alvo_tipo)
);

CREATE TABLE midia (
  id_midia   BIGSERIAL PRIMARY KEY,
  pub_id     BIGINT NOT NULL,
  url        TEXT NOT NULL,
  tipo       tipo_midia_enum,
  tamanho_kb INTEGER,
  formato    VARCHAR(10),
  validado   BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (pub_id) REFERENCES publicacao(id_pub) ON DELETE CASCADE
);

/* ==========================================================================
   3. TABELAS “SUPORTE”
   ========================================================================== */
CREATE TABLE hashtag (
  texto    VARCHAR(100) PRIMARY KEY,
  qtd_uso  BIGINT DEFAULT 1
);

CREATE TABLE mencao (
  pub_id                BIGINT REFERENCES publicacao(id_pub) ON DELETE CASCADE,
  usuario_mencionado_id BIGINT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  PRIMARY KEY (pub_id, usuario_mencionado_id)
);

CREATE TABLE notificacao (
  id_notif        BIGSERIAL PRIMARY KEY,
  destinatario_id BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  mensagem        TEXT,
  tipo            tipo_notif_enum,
  lida            BOOLEAN DEFAULT FALSE,
  timestamp       TIMESTAMPTZ DEFAULT now()
);

/* --------------------------------------------------------------------------
   Log de moderação & auditoria
   -------------------------------------------------------------------------- */
CREATE TABLE moderacao (
  id_mod       BIGSERIAL PRIMARY KEY,
  pub_id       BIGINT REFERENCES publicacao(id_pub) ON DELETE CASCADE,
  moderador_id BIGINT REFERENCES usuario(id_usuario),
  decisao      status_mod_enum,
  motivo       TEXT,
  automatica   BOOLEAN,
  timestamp    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE log_auditoria (
  id_log        BIGSERIAL PRIMARY KEY,
  acao          VARCHAR(100),
  responsavel_id BIGINT REFERENCES usuario(id_usuario),
  alvo          VARCHAR(100),
  detalhe       JSONB,
  timestamp     TIMESTAMPTZ DEFAULT now()
);

/* ==========================================================================
   4. TABELA DE EVENTO (alto throughput, sem FK rígida)
   ========================================================================== */
CREATE TABLE feed_evento (
  id_evt    BIGSERIAL PRIMARY KEY,
  tipo_evt  tipo_evento_enum,
  payload   JSONB,                     -- ids e metadados do domínio
  timestamp TIMESTAMPTZ DEFAULT now()
);

/* ==========================================================================
   5. ÍNDICES AUXILIARES
   ========================================================================== */
-- Busca por autor e data
CREATE INDEX idx_pub_autor_data ON publicacao (autor_id DESC);
CREATE INDEX idx_coment_pub_data ON comentario (pub_id DESC);

-- Full-text search nas publicações
ALTER TABLE publicacao
  ADD COLUMN tsv tsvector GENERATED ALWAYS AS
        (to_tsvector('portuguese', coalesce(texto,''))) STORED;
CREATE INDEX gin_pub_tsv ON publicacao USING GIN(tsv);

-- Pesquisa trigramatica em usuário.nome + @username
CREATE INDEX gin_user_name_trgm ON usuario USING GIN (nome gin_trgm_ops);



/* ==========================================================================
   7. GATILHO – atualizar contador de hashtag (UPSERT)
   ========================================================================== */
CREATE OR REPLACE FUNCTION f_upsert_hashtags() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  tag TEXT;
BEGIN
  FOR tag IN SELECT unnest(regexp_matches(NEW.texto, '#([A-Za-z0-9_]+)', 'g')) LOOP
    INSERT INTO hashtag (texto, qtd_uso)
         VALUES (lower(tag), 1)
    ON CONFLICT (texto) DO UPDATE
       SET qtd_uso = hashtag.qtd_uso + 1;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_hashtag_upsert
AFTER INSERT ON publicacao
FOR EACH ROW EXECUTE FUNCTION f_upsert_hashtags();

CREATE TABLE redefinicao_senha (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  token         TEXT UNIQUE NOT NULL,
  expira_em     TIMESTAMPTZ NOT NULL,
  criado_em     TIMESTAMPTZ DEFAULT now()
);

-- Criamos um índice na coluna de token para buscas rápidas
CREATE INDEX idx_redefinicao_senha_token ON redefinicao_senha(token);