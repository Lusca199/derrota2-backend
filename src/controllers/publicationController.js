// Ficheiro: Testes/derrota2-backend/src/controllers/publicationController.js
// Versão FINAL com notificações de menção e CRUD completo de publicações

const db = require('../config/database');

// --- FUNÇÃO AUXILIAR ATUALIZADA ---
// Agora recebe o autor da publicação para criar a notificação
const processarMencoes = async (texto, pub_id, autor) => {
    const regex = /@(\w+)/g;
    const matches = texto.match(regex);
    if (!matches) return;

    const usernames = [...new Set(matches.map(m => m.substring(1)))];

    for (const username of usernames) {
        try {
            // Encontra o usuário mencionado
            const userResult = await db.query(
                "SELECT id_usuario FROM usuario WHERE split_part(email, '@', 1) ILIKE $1",
                [username]
            );

            if (userResult.rows.length > 0) {
                const mencionado_id = userResult.rows[0].id_usuario;
                // Regista a menção na tabela 'mencao'
                await db.query(
                    'INSERT INTO mencao (pub_id, usuario_mencionado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [pub_id, mencionado_id]
                );

                // --- LÓGICA DE NOTIFICAÇÃO DE MENÇÃO ---
                // Evitar auto-notificação e verificar preferências
                if (Number(mencionado_id) !== Number(autor.id)) {
                    const configResult = await db.query('SELECT notificacoes_ativas FROM configuracao_usuario WHERE id_usuario = $1', [mencionado_id]);
                    if (configResult.rows.length > 0 && configResult.rows[0].notificacoes_ativas) {
                        const mensagem = `${autor.nome} mencionou você em uma publicação.`;
                        // --- ALTERAÇÃO AQUI: Adicionamos a coluna origem_id ---
                        await db.query(
                            `INSERT INTO notificacao (destinatario_id, mensagem, tipo, origem_id) 
                             VALUES ($1, $2, 'MENCION', $3)`,
                            [mencionado_id, mensagem, pub_id] // O origem_id é o ID da publicação com a menção
                        );
                    }
                }
            }
        } catch (error) {
            console.error(`Erro ao processar menção ou notificação para @${username}:`, error);
        }
    }
};

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
    const authorResult = await db.query('SELECT nome, foto_perfil_url FROM usuario WHERE id_usuario = $1', [autor_id]);
    const autor = { id: autor_id, nome: authorResult.rows[0].nome };

    if (texto) {
        // Passamos o objeto 'autor' para a função de menções
        await processarMencoes(texto, newPublication.id_pub, autor);
    }

    let mediaUrl = null;
    if (mediaFile) {
      mediaUrl = `/public/media/${mediaFile.filename}`;
      await db.query(
        'INSERT INTO midia (pub_id, url, tipo) VALUES ($1, $2, $3)',
        [newPublication.id_pub, mediaUrl, 'IMAGE']
      );
    }
    
    res.status(201).json({
      ...newPublication,
      autor_id,
      nome_autor: authorResult.rows[0].nome,
      autor_foto_perfil_url: authorResult.rows[0].foto_perfil_url,
      media_url: mediaUrl,
      like_count: 0,
      is_liked_by_me: false,
      mencoes: [], // Front-end espera este campo, mesmo que vazio inicialmente
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor ao criar a publicação.' });
  }
};

// ... as funções getAllPublications, getPublicationById, getPublicationsByUser permanecem inalteradas ...
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
       LEFT JOIN relacao_usuario r_block ON 
            r_block.bloqueado = TRUE AND (
                (r_block.seguidor_id = $1 AND r_block.seguido_id = p.autor_id) OR
                (r_block.seguidor_id = p.autor_id AND r_block.seguido_id = $1)
            )
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
exports.getPublicationsByUser = async (req, res) => {
  const { userId: authorId } = req.params;
  const requesterId = req.user ? req.user.id : null;
  try {
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
       WHERE p.autor_id = $1
       ORDER BY p.criado_em DESC`,
      [authorId, requesterId]
    );
    res.status(200).json(publications.rows);
  } catch (error) {
    console.error("Erro ao buscar publicações do usuário:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};


// --- FUNÇÃO DE ATUALIZAÇÃO IMPLEMENTADA ---
exports.updatePublication = async (req, res) => {
  const { id: pub_id } = req.params;
  const { texto } = req.body;
  const user_id = req.user.id;

  if (!texto || texto.trim() === "") {
      return res.status(400).json({ error: 'O texto não pode ficar vazio.' });
  }

  try {
    const result = await db.query(
        `UPDATE publicacao SET texto = $1, editada = TRUE 
         WHERE id_pub = $2 AND autor_id = $3 
         RETURNING *`,
        [texto, pub_id, user_id]
    );

    if (result.rowCount === 0) {
        return res.status(403).json({ error: 'Não autorizado a editar esta publicação ou publicação não encontrada.' });
    }

    // Opcional: Re-processar menções após a edição.
    // Por simplicidade, vamos omitir por agora, mas poderia ser adicionado aqui.

    // Para consistência, retornamos o mesmo formato de objeto da criação
    const authorResult = await db.query('SELECT nome, foto_perfil_url FROM usuario WHERE id_usuario = $1', [user_id]);
    const updatedPublication = {
        ...result.rows[0],
        nome_autor: authorResult.rows[0].nome,
        autor_foto_perfil_url: authorResult.rows[0].foto_perfil_url,
    };
    
    res.status(200).json(updatedPublication);
  } catch (error) {
      console.error("Erro ao editar publicação:", error);
      res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// --- FUNÇÃO DE APAGAR IMPLEMENTADA ---
exports.deletePublication = async (req, res) => {
  const { id: pub_id } = req.params;
  const user_id = req.user.id;

  try {
      // A consulta DELETE verifica se o id da publicação E o id do autor correspondem.
      // Isto previne que um usuário apague a publicação de outro.
      const result = await db.query(
          'DELETE FROM publicacao WHERE id_pub = $1 AND autor_id = $2',
          [pub_id, user_id]
      );

      // Se rowCount for 0, a publicação não foi encontrada ou o usuário não era o autor.
      if (result.rowCount === 0) {
          return res.status(403).json({ error: 'Não autorizado a apagar esta publicação ou publicação não encontrada.' });
      }

      res.status(204).send(); // 204 No Content é a resposta padrão para um delete bem-sucedido.
  } catch (error) {
      console.error("Erro ao apagar publicação:", error);
      res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};