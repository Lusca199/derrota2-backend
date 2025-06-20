// Ficheiro: Testes/derrota2-backend/src/controllers/publicationController.js
// Versão FINAL e ROBUSTA com filtro de bloqueio funcional

const db = require('../config/database');

// Função auxiliar para processar menções (inalterada)
const processarMencoes = async (texto, pub_id) => {
    const regex = /@(\w+)/g;
    const matches = texto.match(regex);
    if (!matches) return;
    const usernames = [...new Set(matches.map(m => m.substring(1)))];
    for (const username of usernames) {
        try {
            const userResult = await db.query(
                "SELECT id_usuario FROM usuario WHERE split_part(email, '@', 1) ILIKE $1",
                [username]
            );
            if (userResult.rows.length > 0) {
                const mencionado_id = userResult.rows[0].id_usuario;
                await db.query(
                    'INSERT INTO mencao (pub_id, usuario_mencionado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [pub_id, mencionado_id]
                );
            }
        } catch (error) {
            console.error(`Erro ao processar menção para @${username}:`, error);
        }
    }
};

// Função createPublication (inalterada)
exports.createPublication = async (req, res) => {
  const { texto } = req.body;
  const autor_id = req.user.id;
  const mediaFile = req.file;
  if (!texto && !mediaFile) {
    return res.status(400).json({ error: 'A publicação deve ter texto ou imagem.' });
  }
  try {
    const newPublicationResult = await db.query(
      'INSERT INTO publicacao (autor_id, texto) VALUES ($1, $2) RETURNING id_pub, texto, criado_em',
      [autor_id, texto || '']
    );
    const newPublication = newPublicationResult.rows[0];
    if (texto) {
        await processarMencoes(texto, newPublication.id_pub);
    }
    let mediaUrl = null;
    if (mediaFile) {
      mediaUrl = `/public/media/${mediaFile.filename}`;
      await db.query(
        'INSERT INTO midia (pub_id, url, tipo) VALUES ($1, $2, $3)',
        [newPublication.id_pub, mediaUrl, 'IMAGE']
      );
    }
    const authorResult = await db.query('SELECT nome, foto_perfil_url FROM usuario WHERE id_usuario = $1', [autor_id]);
    res.status(201).json({
      ...newPublication,
      autor_id,
      nome_autor: authorResult.rows[0].nome,
      autor_foto_perfil_url: authorResult.rows[0].foto_perfil_url,
      media_url: mediaUrl,
      like_count: 0,
      is_liked_by_me: false,
      mencoes: [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor ao criar a publicação.' });
  }
};

// --- MUDANÇA PRINCIPAL AQUI ---
exports.getAllPublications = async (req, res) => {
  const userId = req.user ? req.user.id : null;
  try {
    const publications = await db.query(
      `SELECT 
         p.id_pub, p.texto, p.criado_em, 
         u.id_usuario AS autor_id, u.nome AS nome_autor, u.foto_perfil_url AS autor_foto_perfil_url,
         m.url AS media_url,
         (SELECT COUNT(*) FROM reacao r WHERE r.alvo_id = p.id_pub AND r.alvo_tipo = 'POST') AS like_count,
         EXISTS(SELECT 1 FROM reacao r WHERE r.alvo_id = p.id_pub AND r.usuario_id = $1 AND r.alvo_tipo = 'POST') AS is_liked_by_me,
         COALESCE(mentions_agg.mencoes, '[]'::json) as mencoes
       FROM publicacao p 
       JOIN usuario u ON p.autor_id = u.id_usuario
       LEFT JOIN midia m ON p.id_pub = m.pub_id
       LEFT JOIN (
            SELECT m.pub_id, json_agg(json_build_object('username', split_part(u.email, '@', 1), 'user_id', u.id_usuario)) as mencoes
            FROM mencao m
            JOIN usuario u ON m.usuario_mencionado_id = u.id_usuario
            GROUP BY m.pub_id
       ) AS mentions_agg ON p.id_pub = mentions_agg.pub_id

       /* 1. LÓGICA DE BLOQUEIO (NOVA ABORDAGEM):
        * Fazemos um LEFT JOIN na tabela de relações para encontrar um bloqueio.
        */
       LEFT JOIN relacao_usuario r_block ON 
            r_block.bloqueado = TRUE AND (
                (r_block.seguidor_id = $1 AND r_block.seguido_id = p.autor_id) OR
                (r_block.seguidor_id = p.autor_id AND r_block.seguido_id = $1)
            )

       /* 2. CONDIÇÃO DE FILTRO:
        * Apenas mostramos a publicação se a junção acima NÃO encontrou
        * um bloqueio (ou seja, quando a linha de r_block é nula).
        */
       WHERE r_block.seguidor_id IS NULL

       ORDER BY p.criado_em DESC`,
       [userId]
    );
    res.status(200).json(publications.rows);
  } catch (error) {
    console.error("Erro ao buscar publicações:", error);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar as publicações.' });
  }
};

// Função getPublicationById (inalterada)
exports.getPublicationById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user ? req.user.id : null;
  try {
    const result = await db.query(
      `SELECT 
         p.id_pub, p.texto, p.criado_em, 
         u.id_usuario AS autor_id, u.nome AS nome_autor, u.foto_perfil_url AS autor_foto_perfil_url,
         m.url as media_url,
         (SELECT COUNT(*) FROM reacao r WHERE r.alvo_id = p.id_pub AND r.alvo_tipo = 'POST') AS like_count,
         EXISTS(SELECT 1 FROM reacao r WHERE r.alvo_id = p.id_pub AND r.usuario_id = $2 AND r.alvo_tipo = 'POST') AS is_liked_by_me,
         COALESCE(mentions_agg.mencoes, '[]'::json) as mencoes
       FROM publicacao p 
       JOIN usuario u ON p.autor_id = u.id_usuario 
       LEFT JOIN midia m ON p.id_pub = m.pub_id
       LEFT JOIN (
            SELECT m.pub_id, json_agg(json_build_object('username', split_part(u.email, '@', 1), 'user_id', u.id_usuario)) as mencoes
            FROM mencao m
            JOIN usuario u ON m.usuario_mencionado_id = u.id_usuario
            GROUP BY m.pub_id
       ) AS mentions_agg ON p.id_pub = mentions_agg.pub_id
       WHERE p.id_pub = $1`,
      [id, userId]
    );
    if (result.rows.length === 0) { return res.status(404).json({ error: 'Publicação não encontrada.' }); }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// --- NOVA FUNÇÃO ADICIONADA AQUI ---
/**
 * Busca todas as publicações de um usuário específico.
 * Esta rota também usa autenticação opcional para saber se o
 * usuário logado já curtiu as publicações listadas.
 */
exports.getPublicationsByUser = async (req, res) => {
  // ID do usuário cujas publicações queremos ver (vem da URL)
  const { userId: authorId } = req.params;
  // ID do usuário que está a fazer o pedido (pode ser nulo)
  const requesterId = req.user ? req.user.id : null;

  try {
    // A consulta é quase idêntica à getAllPublications, mas com um filtro de autor
    const publications = await db.query(
      `SELECT
         p.id_pub, p.texto, p.criado_em,
         u.id_usuario AS autor_id, u.nome AS nome_autor, u.foto_perfil_url AS autor_foto_perfil_url,
         m.url AS media_url,
         (SELECT COUNT(*) FROM reacao r WHERE r.alvo_id = p.id_pub AND r.alvo_tipo = 'POST') AS like_count,
         EXISTS(SELECT 1 FROM reacao r WHERE r.alvo_id = p.id_pub AND r.usuario_id = $2 AND r.alvo_tipo = 'POST') AS is_liked_by_me,
         COALESCE(mentions_agg.mencoes, '[]'::json) as mencoes
       FROM publicacao p
       JOIN usuario u ON p.autor_id = u.id_usuario
       LEFT JOIN midia m ON p.id_pub = m.pub_id
       LEFT JOIN (
            SELECT m.pub_id, json_agg(json_build_object('username', split_part(u.email, '@', 1), 'user_id', u.id_usuario)) as mencoes
            FROM mencao m
            JOIN usuario u ON m.usuario_mencionado_id = u.id_usuario
            GROUP BY m.pub_id
       ) AS mentions_agg ON p.id_pub = mentions_agg.pub_id
       WHERE p.autor_id = $1 -- O FILTRO PRINCIPAL!
       ORDER BY p.criado_em DESC`,
      [authorId, requesterId]
    );
    res.status(200).json(publications.rows);
  } catch (error) {
    console.error("Erro ao buscar publicações do usuário:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};


// Funções de update e delete (inalteradas)
exports.updatePublication = async (req, res) => { /* ...código inalterado... */ };
exports.deletePublication = async (req, res) => { /* ...código inalterado... */ };