// src/controllers/commentController.js
// Versão com notificação de comentário e origem_id

const db = require('../config/database');

/**
 * Lógica para CRIAR um novo comentário em uma publicação.
 * Esta função é protegida e requer que o usuário esteja autenticado.
 */
exports.createComment = async (req, res) => {
  const { publicationId } = req.params; 
  const { texto } = req.body; 
  const commenterId = req.user.id; // Renomeado para clareza: ID de quem está a comentar

  if (!texto || texto.trim() === '') {
    return res.status(400).json({ error: 'O texto do comentário não pode estar vazio.' });
  }

  try {
    // Insere o novo comentário na base de dados
    const result = await db.query(
      `INSERT INTO comentario (pub_id, autor_id, texto) 
       VALUES ($1, $2, $3) 
       RETURNING id_coment, texto, criado_em`,
      [publicationId, commenterId, texto]
    );

    const novoComentario = result.rows[0];

    // --- INÍCIO DA LÓGICA DE NOTIFICAÇÃO DE COMENTÁRIO ---
    try {
        // 1. Encontrar o autor da publicação original
        const postResult = await db.query('SELECT autor_id FROM publicacao WHERE id_pub = $1', [publicationId]);

        if (postResult.rows.length > 0) {
            const autorPostId = postResult.rows[0].autor_id;

            // 2. Evitar auto-notificação
            if (Number(autorPostId) !== Number(commenterId)) {
                // 3. Verificar preferências de notificação do autor do post
                const configResult = await db.query(
                    'SELECT notificacoes_ativas FROM configuracao_usuario WHERE id_usuario = $1',
                    [autorPostId]
                );

                if (configResult.rows.length > 0 && configResult.rows[0].notificacoes_ativas) {
                    // 4. Obter o nome de quem comentou
                    const commenterInfo = await db.query('SELECT nome FROM usuario WHERE id_usuario = $1', [commenterId]);
                    const nomeCommenter = commenterInfo.rows[0]?.nome || 'Alguém';

                    // 5. Criar a notificação para o autor do post
                    const mensagem = `${nomeCommenter} respondeu à sua publicação.`;
                    // --- ALTERAÇÃO AQUI: Adicionamos a coluna origem_id ---
                    await db.query(
                        `INSERT INTO notificacao (destinatario_id, mensagem, tipo, origem_id) 
                         VALUES ($1, $2, 'REPLY', $3)`,
                        [autorPostId, mensagem, publicationId] // O origem_id é o ID da publicação comentada
                    );
                }
            }
        }
    } catch (notificationError) {
        console.error("Falha ao criar notificação de 'comentário':", notificationError);
    }
    // --- FIM DA LÓGICA DE NOTIFICAÇÃO ---


    // Para uma melhor experiência no front-end, retornamos o comentário completo
    const autor = await db.query('SELECT nome, foto_perfil_url FROM usuario WHERE id_usuario = $1', [commenterId]);

    res.status(201).json({
        ...novoComentario,
        autor_id: commenterId,
        nome_autor: autor.rows[0].nome,
        autor_foto_perfil_url: autor.rows[0].foto_perfil_url
    });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    if (error.code === '23503') { 
        return res.status(404).json({ error: 'Publicação não encontrada.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

/**
 * Lógica para LER todos os comentários de uma publicação específica.
 * Esta rota é pública.
 */
exports.getCommentsForPublication = async (req, res) => {
  const { publicationId } = req.params;

  try {
    const result = await db.query(
      `SELECT 
            c.id_coment AS id_comentario, 
            c.texto, 
            c.criado_em, 
            u.id_usuario AS autor_id, 
            u.nome AS nome_autor, 
            u.foto_perfil_url AS autor_foto_perfil_url
       FROM comentario c
       JOIN usuario u ON c.autor_id = u.id_usuario
       WHERE c.pub_id = $1
       ORDER BY c.criado_em ASC`,
      [publicationId]
    );

    res.status(200).json(result.rows);
  } catch (error)
  {
    console.error('Erro ao buscar comentários:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};